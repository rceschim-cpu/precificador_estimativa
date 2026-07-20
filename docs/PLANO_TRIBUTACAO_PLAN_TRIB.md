# Plano de alteração — alinhar cálculo tributário à PLAN_TRIB 26.03.2026

> **Contexto pra quem vai executar:** uma auditoria comparou a planilha oficial
> da Controladoria ("Planilha de tributação POSITEC - PLAN_TRIB 26.03.2026.xlsx")
> com as lógicas de cálculo do app (`src/App.jsx`). A matriz de ICMS interestadual
> (MX, 729 células) e a tabela de P/C da ZFM bateram 100%. As divergências estão
> em: (1) ICMS de venda dentro do próprio estado, (2) ST que varia por destino,
> (3) FCP por produto e DIFAL de contribuinte, e (4) dados desatualizados nos
> perfis `PRODUTOS[]`. Este plano corrige na ordem de impacto.
>
> **Os dados já foram extraídos da planilha** para `src/planTrib.js` (gerado por
> `scripts/plan_trib/extrair_dados.py` — NÃO editar o .js na mão). O trabalho
> deste plano é só LIGAR esses dados ao cálculo, na ordem das etapas.

## Regras obrigatórias (leia antes de começar)

1. **Leia o CLAUDE.md do repositório inteiro antes de qualquer edição.**
2. Execute UMA etapa por vez, na ordem. Ao fim de cada etapa:
   `npx vite build --logLevel warn` (precisa passar limpo) → commit (mensagem
   em português, explicando causa e efeito) → `git push origin HEAD:main` e
   `git push gitlab HEAD:main`.
3. **NÃO altere nenhuma fórmula fora do escopo explícito da etapa.** Em
   particular: não mexa em P/C (pcEf/pcSubvPct), IPI, crédito de IPI IOS,
   deságio CWB, COEF_ACES_IOS, margem/MC/ML.
4. Não mexa em nada do Supabase (tabelas, RPCs, cadastro de produtos).
5. As âncoras de código abaixo são trechos pra localizar com grep — os números
   de linha mudam, o texto é o guia.
6. Se algo não bater com o descrito aqui (âncora não existe, build quebra de
   um jeito não explicado), PARE e reporte — não improvise.

---

## Etapa 0 — preparação (sem mudança de comportamento)

**Objetivo:** importar os dados gerados e expor o NCM no objeto de atributos
do produto (hoje `getProdAtributos` não devolve o NCM, e as tabelas novas são
chaveadas por NCM).

1. No topo de `src/App.jsx` (logo abaixo do `import { useState... } from "react";`):
   ```js
   import { ICMS_INTRA, ST_DEST, DIFAL_INT, FCP_PROD } from "./planTrib.js";
   ```
2. Em `getProdAtributos` (grep: `pcBase: o.zmf && !isCBU`), adicionar ao objeto
   retornado, junto dos campos existentes:
   ```js
   ncm: prod.ncm || "",
   ```
3. Build → deve compilar sem warnings novos. Nada muda no comportamento ainda.

**Commit sugerido:** "Prepara integração da PLAN_TRIB: importa tabelas extraídas e expõe NCM em getProdAtributos"

---

## Etapa 1 — ICMS de venda DENTRO do estado de origem (maior impacto)

**O problema:** hoje, venda MAO→AM usa a alíquota interna genérica do AM (20%)
menos o crédito presumido interestadual cadastrado (ex. 12%) → 8% efetivo. A
planilha diz que produto PPB incentivado vendido dentro do AM tem ICMS
destacado de **7% com crédito presumido de 7% → efetivo 0%**. O mesmo vale pra
BA→BA (20,5%/20,5% → 0) e PR→PR (varia por produto). A tabela `ICMS_INTRA`
tem exatamente isso, chaveada por `"NCM|UFOrigem"`.

**Onde mexer** — no motor de cálculo, localizar (grep):
```js
const ufO=prodAtrib.uf,ufD=d.ufDestino,intra=ufO===ufD;
const aliqInter=getICMS(ufO,ufD);
```
e algumas linhas abaixo:
```js
const icmsEfPct=Math.max(0,aliqInter-prodAtrib.cred);
```

**Mudança:** trocar `const aliqInter` por `let`, e aplicar o override intra
logo depois (respeitando CBU, que não tem benefício de fabricação):
```js
let aliqInter=getICMS(ufO,ufD);
let credProd=prodAtrib.cred;
const intraInfo=(intra&&!isCBU)?ICMS_INTRA[`${prodAtrib.ncm}|${ufO}`]:null;
if(intraInfo){aliqInter=intraInfo.aliq;credProd=intraInfo.cred;}
```
e:
```js
const icmsEfPct=Math.max(0,aliqInter-credProd);
```

Não mexa em mais nada: `aliqInter` já alimenta o `icmsV` (ICMS destacado na
NF), a redução de base do P/C e o resto — com o override, esses pontos passam
a usar a alíquota certa automaticamente. O DIFAL já é protegido por `!intra`.

**Atenção:** a variável `isCBU` já existe nesse escopo (grep `isCBU` dentro da
mesma função pra confirmar). O deságio de CWB (`icmsOrigemEf ... *(1-0.35)`)
NÃO deve ser alterado — ele atua em outro campo (`icms` de importação), não no
`aliqInter` da venda.

**Testes de aceite** (fazer na Calculadora Detalhada manual, modo CKD, e
conferir no painel esquerdo/aba Venda):
| Cenário | Esperado |
|---|---|
| Terminal de Pagamento (NCM 8470.50.10), MAO, UF destino AM | ICMS efetivo **0%** (destacado 7%, crédito 7%) |
| Notebook 15"+ (8471.30.19), MAO, destino AM | ICMS efetivo **0%** |
| Notebook 15"+ (8471.30.19), IOS, destino BA | ICMS efetivo **0%** (20,5% − 20,5%) |
| Teclado Imp. Direta (8471.60.52), MAO, destino AM | ICMS efetivo **20%** (destacado 20%, crédito 0) |
| Notebook, MAO, destino SP | **NADA muda** (12% − 12% = 0, igual a antes) |
| Qualquer produto CBU, destino = UF de origem | **NADA muda** (override não se aplica a CBU) |

**Commit sugerido:** "ICMS de venda intra-estado passa a usar alíquota/crédito específicos da PLAN_TRIB (MAO→AM efetivo 0% pra PPB)"

---

## Etapa 2 — ST (MVA e alíquota) por estado de destino

**O problema:** o app tem UM par fixo (mva, aliqST) por produto pra qualquer
destino (ex. notebook: 35%/19%). A planilha varia por destino: notebook →SP é
MVA 40%/alíquota 18%; →RJ 29,59%/22%; →MG 25%/**7%**; →AM 27%/7%. E alguns
produtos NÃO têm ST em certos destinos (ex. Lâmpada WiFi pra SP). A tabela
`ST_DEST` tem `"NCM|UFOrigem" -> { UFdest: {mva, aliq} }` — só os destinos
onde a planilha marca "SIM".

**Estratégia (não mexer na fórmula!):** a fórmula de ST atual —
```js
if(d.stAtivo&&d.mva>0){stBase=pCI*(1+d.mva/100);stV=Math.max(0,stBase*(d.icmsDestST/100)-icmsV);}
```
— fica **intocada**. O que muda é COMO os inputs `d.stAtivo`, `d.mva` e
`d.icmsDestST` são preenchidos: hoje eles são setados uma única vez na seleção
do produto (grep: `stAtivo:p.mva>0,mva:p.mva,icmsDestST:p.aliqST`) e não
reagem à mudança de UF de destino.

**Mudança:** dentro do componente `Calculadora` (onde vivem os outros
`useEffect`), adicionar um efeito que sincroniza os três campos sempre que
produto/origem/UF de destino mudarem:
```js
// ST por destino (PLAN_TRIB): MVA e alíquota interna variam por UF de destino.
// Sobrescreve os campos de ST sempre que produto/origem/destino mudam; o
// usuário ainda pode editar manualmente depois (o efeito só roda nessas mudanças).
useEffect(()=>{
  const ncm=prodAtrib?.ncm;
  if(!ncm)return;
  const porDest=ST_DEST[`${ncm}|${prodAtrib.uf}`];
  if(porDest===undefined)return; // NCM não mapeado na PLAN_TRIB: mantém comportamento antigo
  const e=porDest[d.ufDestino];
  if(e)setD(p=>({...p,stAtivo:true,mva:e.mva,icmsDestST:e.aliq}));
  else setD(p=>({...p,stAtivo:false,mva:0}));
},[d.prodId,d.origem,d.modalidade,d.ufDestino]);
```
Colocar esse efeito perto dos outros `useEffect` do componente (grep:
`useEffect(()=>{` dentro de `function Calculadora`). Verifique que
`prodAtrib` está acessível nesse ponto (é calculado no corpo do componente).

**Cuidado com loop:** o efeito seta estado mas só dispara nas 4 dependências
listadas (que ele não altera) — não entra em loop. NÃO adicionar `d.stAtivo`
ou `prodAtrib` às dependências.

**Testes de aceite:**
| Cenário | Esperado (com "Aplicar ICMS-ST" refletindo sozinho) |
|---|---|
| Notebook 15"+, MAO, destino SP, revenda | ST ativo, MVA 40, alíq. 18 |
| Mesmo produto, mudar destino pra MG | MVA vira 25, alíq. vira **7** |
| Mesmo produto, mudar destino pra RJ | MVA 29,59, alíq. 22 |
| Smart Lâmpada WiFi (8539.52.00), CWB, destino SP | ST **desativado** (mva 0) |
| Smartphone (8517.13.00), IOS, destino SP | ST ativo, MVA 28, alíq. **12** |
| Produto do Cadastro com NCM fora da PLAN_TRIB | comportamento igual ao de hoje |
| Editar MVA manualmente depois de escolhido o destino | valor manual permanece (efeito não re-dispara) |

**Commit sugerido:** "ST passa a usar MVA e alíquota específicas por UF de destino (tabela ST_DEST da PLAN_TRIB)"

---

## Etapa 3 — FCP por produto×UF e DIFAL de contribuinte (base dupla)

### 3a. FCP

**O problema:** o app cobra FCP fixo por UF (`FCP={AL:1,MG:1,RJ:2,SE:1}`).
A planilha mostra que MG só cobra 2% de smartphones/feature phones/câmeras
(0% do resto — o 1% do app está errado nos dois sentidos), e PB cobra 2% de
luminárias/LED (o app não tem PB). AL/RJ/SE são fixos e batem.

**Mudança:**
1. Trocar a constante (grep `const FCP={AL:1,MG:1,RJ:2,SE:1};`):
   ```js
   const FCP={AL:1,RJ:2,SE:1}; // MG e PB são por produto — ver FCP_PROD (PLAN_TRIB)
   ```
2. No cálculo (grep `const fcpPct=FCP[ufD]||0;`):
   ```js
   const fcpPct=FCP_PROD[prodAtrib.ncm]?.[ufD] ?? FCP[ufD] ?? 0;
   ```
   Obs.: `FCP_PROD` traz TODOS os estados com FCP>0 por NCM (inclui AL/RJ/SE
   de novo com os mesmos valores — redundância inofensiva; o fallback `FCP`
   cobre NCMs fora da tabela).

**Testes:** Smartphone destino MG → FCP 2%. Notebook destino MG → FCP 0%.
Fita LED (9405.42.00) destino PB → FCP 2%. Qualquer produto destino RJ → 2%
(inalterado). Destino AL → 1% (inalterado).

### 3b. DIFAL de contribuinte consumidor final (base dupla)

**O problema:** pra consumidor final CONTRIBUINTE (destinação ativo
imobilizado), a planilha calcula DIFAL com gross-up ("base dupla"): AM→SP dá
**7,317%** = (18−12)/(1−0,18), não os 6% simples que o app usa. Pra
NÃO-contribuinte os 6% simples do app batem com a planilha (não mexer).
Além disso a alíquota interna do destino pode ser específica do produto
(ex. smartphone em SP: 12%, não 18%) — a tabela `DIFAL_INT`
(`"NCM|UFdest" -> aliq`) traz só os casos que diferem da genérica.

**Mudança** — localizar (grep):
```js
const aliqDest=ALIQ_INT[ufD]||18;
```
trocar por:
```js
const aliqDest=DIFAL_INT[`${prodAtrib.ncm}|${ufD}`] ?? (ALIQ_INT[ufD]||18);
```
e localizar o cálculo do DIFAL:
```js
if(!intra&&deveDifal){const delta=aliqDest-aliqInter;if(delta>0)difal=(prodAtrib.aliqST>0&&delta<prodAtrib.aliqST)?0:delta;}
```
trocar por:
```js
if(!intra&&deveDifal){
  let delta=aliqDest-aliqInter;
  // contribuinte consumidor final (imobilizado): base dupla (LC 190/2022) — gross-up pela interna do destino
  if(d.tipoComprador==="contrib"&&delta>0)delta=delta/(1-aliqDest/100);
  if(delta>0)difal=(prodAtrib.aliqST>0&&delta<prodAtrib.aliqST)?0:delta;
}
```

> ⚠️ **Dúvida em aberto registrada na auditoria:** a exceção
> `prodAtrib.aliqST>0 && delta<aliqST → difal=0` (documentada no CLAUDE.md)
> zera o DIFAL de produtos com ST, mas a planilha mostra DIFAL preenchido
> mesmo pra produtos com ST (são cenários alternativos: revenda→ST,
> consumidor final→DIFAL). **Manter a exceção como está** — só o Rafael pode
> autorizar removê-la. Deixar este comentário no código ao lado da exceção.

**Testes:** Notebook MAO→SP, contribuinte + ativo imobilizado → DIFAL 7,32%
(se a exceção de ST não zerar — anotar o resultado observado no commit).
Notebook MAO→SP, não-contribuinte → DIFAL 6% (igual a hoje).
Smartphone IOS→SP, não-contribuinte → DIFAL **0%** (interna do produto em SP
é 12% = interestadual 12%, delta 0).

**Commit sugerido:** "FCP por produto×UF e DIFAL base dupla p/ contribuinte consumidor final (PLAN_TRIB)"

---

## Etapa 4 — correções de dados nos perfis PRODUTOS[]

Corrigir na tabela hardcoded `PRODUTOS[]` (grep `const PRODUTOS = [`) apenas
os campos abaixo. **MVA/aliqST dos perfis viram fallback** depois da Etapa 2
(usados só pra NCM fora da PLAN_TRIB) — atualizá-los para os valores de SP
(destino mais comum) por consistência:

| id | campo | de | para | fonte (PLAN_TRIB, Destino SP) |
|---|---|---|---|---|
| cpu | ipiIOS | 9.75 | 15 | CPU Peq. IOS: IPI 15% |
| fled | ipiCWB | 0 | 9.75 | Fita LED CWB: IPI 9,75% |
| tab7 | credCWB | 7 | 12 | Tablet 7 CWB: crédito 12% |
| kbd | credIOS | 3 | 4 | Teclado IOS: crédito 4% |
| kbd | credCWB | 0 | 4 | Teclado CWB: crédito 4% |
| lock | credIOS | 0 | 3 | Trava segurança IOS: crédito 3% |
| bln | credCWB | 0 | 4 | Carregador 8504.40.21 CWB: crédito 4% |
| nb12/nb19 | mva / aliqST | 35 / 19 | 40 / 18 | |
| tab7 | mva / aliqST | 35 / 19 | 40 / 18 | |
| cpu | mva / aliqST | 35 / 19 | 36 / 18 | |
| aio | mva / aliqST | 35 / 19 | 30 / 18 | |
| smt / fp | mva / aliqST | 25 / 19 | 28 / 18 (smt→SP: alíq 12) | usar 28/12 p/ smt, 28/18 p/ fp |
| vpc | mva / aliqST | 37 / 19 | 66 / 18 | |
| rtr | mva / aliqST | 35 / 19 | 42 / 18 | |
| gw | mva / aliqST | 35 / 19 | 31 / 12 | |
| cam | mva / aliqST | 35 / 19 | 64 / 18 | |
| kbd | mva / aliqST | 35 / 19 | 40 / 12 | |
| mse | mva / aliqST | 35 / 19 | 40 / 12 | |
| spk | mva / aliqST | 35 / 19 | 41 / 18 | |
| chr | mva / aliqST | 50 / 19 | 70 / 18 | |
| rob/rasp | mva / aliqST | 35 / 19 | 43 / 18 | |
| spg | mva / aliqST | 38 / 19 | 49 / 18 | |
| lum1/lum2 | mva / aliqST | 35 / 19 | 51 / 18 | |
| fled | mva / aliqST | 35 / 19 | 60 / 18 | |
| petf | mva / aliqST | 35 / 19 | 38 / 18 | |
| lock | mva / aliqST | 35 / 19 | 85 / 18 | |
| mlt | mva / aliqST | 45 / 19 | 57.24 / 18 | |
| fone | mva / aliqST | 37 / 19 | 66 / 18 | |
| cabo | mva / aliqST | 36 / 19 | 43 / 12 | |
| nvr | mva / aliqST | 35 / 19 | 39 / 18 | |
| bln | mva / aliqST | 48 / 19 | 56 / 18 | |
| lmp | mva / aliqST | 63.67 / 19 | 0 / 0 (SEM ST p/ SP) | |
| ctrl | mva / aliqST | 35 / 19 | 0 / 0 (SEM ST p/ SP) | |

**NÃO alterar (pendências que só o Rafael resolve — deixar como está):**
- `pos.fti` (2,2%): a planilha diz FTI=0 pro Terminal de Pagamento em todos os
  destinos, mas o CLAUDE.md e o Cadastro dizem 2,2% — **precisa de confirmação
  da Controladoria** antes de mudar (afeta toda precificação de POS).
- Perfil `mon` (Monitor): a planilha tem 5 variantes com créditos diferentes
  (0/3/4/12) que um perfil único não representa — decisão do Rafael.

**Commit sugerido:** "Atualiza perfis PRODUTOS[] com IPI/créditos/MVA da PLAN_TRIB 26.03.2026 (fallbacks pós-ST_DEST)"

---

## Checklist final (depois das 4 etapas)

- [ ] `npx vite build` limpo
- [ ] Teste manual: L300 Stone, MAO, destino AM, comprador dentro da ZFM →
      P/C 0%, ICMS efetivo 0%, DIFAL 0% (impostos praticamente zerados, sobra
      só P/C subvenção — exatamente o cenário que motivou a auditoria)
- [ ] Teste manual: notebook MAO→SP revenda → nada mudou além do MVA/alíq. ST
- [ ] 4 commits empurrados pros DOIS remotos (origin=GitHub e gitlab)
- [ ] Atualizar a seção "LÓGICA TRIBUTÁRIA" do CLAUDE.md com: ICMS intra-estado
      (ICMS_INTRA), ST por destino (ST_DEST), FCP por produto (FCP_PROD),
      DIFAL base dupla p/ contribuinte — citando a PLAN_TRIB 26.03.2026 como fonte
