# CLAUDE.md — Positec Calculadora Tributária

## Projeto
Calculadora tributária React/Vite — Positivo Tecnologia (Positec)
Arquivo principal: `src/App.jsx` (single file, ~3500 linhas)
Stack: React 18, Vite, JSX puro (sem TypeScript, sem bibliotecas externas)

## Deploy
Vercel → GitHub branch `main` — deploy automático após push
Repositório: https://github.com/rceschim-cpu/precificador_estimativa

## Regras obrigatórias
- NUNCA remover funcionalidades existentes
- NUNCA alterar fórmulas tributárias sem confirmação explícita do usuário
- SEMPRE fazer git pull antes de editar
- Commitar e fazer push automaticamente após cada alteração (sem pedir aprovação)
- Mensagens de commit em português
- Trabalhar sempre direto no branch `main` (não criar branches separados)

---

## LÓGICA TRIBUTÁRIA — NÃO ALTERAR SEM CONFIRMAR COM RAFAEL

### Plantas e Modalidades
```
MAO — Manaus/AM   → ZFM: true   (Zona Franca de Manaus)
IOS — Ilhéus/BA   → ZFM: false
CWB — Curitiba/PR → ZFM: false

CKD — Componentes importados + produção nacional (PPB obrigatório)
SKD — Placa principal importada já montada
CBU — Produto 100% acabado importado (PPB não se aplica)
```

### getProdAtributos — Regras por origem × modalidade
```js
isCBU = modalidade === "CBU"
isZFM = origem.zmf === true && !isCBU

// IPI: CBU usa alíquota cheia (ipiIOS || ipiCWB) — sem isenção ZFM
// CKD/SKD MAO: ipiMAO = 0 (isenção Lei 8.387/91)
ipi    = isCBU ? (prod.ipiIOS || prod.ipiCWB || prod[`ipi${origem}`] || 0)
               : prod[`ipi${origem}`]

pcBase = isZFM ? "zmf" : 9.25
icms   = prod[`icms${origem}`]
fti    = isZFM ? prod.fti : 0

// REGRA CONFIRMADA: crédito presumido é benefício de FABRICAÇÃO, não de importação direta
// CKD/SKD: cred > 0 → icmsEfPct = aliqInter − cred (ICMS reduzido)
// CBU: cred = 0 → icmsEfPct = aliqInter (ICMS cheio — sem crédito presumido na venda)
cred   = isCBU ? 0 : prod[`cred${origem}`]
```

### Denominador — Formação do Preço
```
ipiF = (origem==="IOS" || isCBU) && ipi>0 ? (1 + ipi/100) : 1

soma = ipiF × (
  pcEf + pcSubvPct
  + icmsEfPct + difal
  + ftiPct + fcpPct
  + indPct + margGerPct + margem
  − ipiCreditoIOSPct
) / 100

pSI = CMV_Total / (1 − soma)
pCI = pSI × (1 + IPI%)
pF  = pCI + ST
```

### P/C (PIS/COFINS)
```
MAO ZFM (CKD/SKD) — regime do COMPRADOR via PC_ZFM:
  Dentro ZFM       → 0%
  Lucro Real 100%  → 3,65%
  Lucro Presumido  → 7,30%
  PF / ONG         → 9,25%
  pcEf = pcPct × (1 − aliqInter% − DIFAL%)

IOS (com IPI):
  pcEf = (pcPct × (1 − aliqInter% − DIFAL%)) / (1 + IPI%)

CWB / CBU:
  pcPct = 9,25% (Lucro Real) ou 3,65% (Presumido)
  pcEf  = pcPct × (1 − aliqInter% − DIFAL%)
```

### P/C Subvenção (crédito presumido — sempre CUSTO, não economia)
```
MAO e CWB:  pcSubvPct = 9,25% × cred%
IOS (c/ IPI): pcSubvPct = max(0, 9,25% × (cred% / (1+IPI%) − 1,2%))
              COEF_ACES_IOS = 1,2% ← calibrado, não alterar
CBU:          pcSubvPct = 0% (sem crédito presumido na venda)
```

### ICMS
```
aliqInter = matriz MX (UF fábrica → UF destino)
icmsEfPct = max(0, aliqInter − cred)

CWB (PR): deságio 35% → icmsOrigemEf = icms × (1 − 0,35) = 7,8% para icms=12%
CBU: icmsDiferimento% pode reduzir ICMS (campo editável)
```

### IPI
```
IPI efetivo "por dentro" (IOS e CBU):
  ipiEfPct = ipi / (1 + ipi/100)
  Ex: 15% nominal → 15/1,15 = 13,04% efetivo

Crédito IPI IOS (entra NEGATIVO na soma):
  ipiCreditoIOSPct = 12.97 / (1 + ipi/100)
  Ex: IPI=15% → 12,97/1,15 = 11,28%  ← VALOR CONFIRMADO por Rafael
  NÃO usar ipi/(1+ipi%) — daria 13,04% (ERRADO)
```

### DIFAL
```
deveDifal = tipoComprador==="naocontrib"
            OU (contrib && destinacao==="imobilizado")
delta = aliqDest_interna − aliqInter
difal = delta > 0 ? delta : 0
# Exceção: produto com ST e delta < aliqST → difal = 0
```

### FTI / UEA-AM
```
Aplica apenas em MAO CKD/SKD quando prod.fti > 0
Produtos com FTI: Terminal de Pagamento, Smartphone, Câmera (2,2%)
```

### Margem Gerencial
```
margGerPct SEMPRE entra no soma (sempre impacta preço e ML)

REGRA CONFIRMADA (2026-06-23): custo fixo NUNCA entra em MC, independente da origem

MC toggle OFF: MC = margV / pF                      ← cfixo e MG fora da MC
MC toggle ON:  MC = (margV + margGerV) / pF         ← só MG entra; cfixo nunca entra

mcSugerida = margemSugerida + (margGerAtivo ? margGer : 0)
mcAlvo     = margemAlvo     + (margGerAtivo ? margGer : 0)

cfixo: entra no soma (indPct) → compõe o preço → afeta ML
       NÃO entra no cálculo de MC
       Exibido como linha informativa no BreakdownPanel abaixo de ML
```

### Índices de Canal (novos campos — Fase 2 da migração)
```
Campos novos vindos de Lista_Canais / Supabase tabela canais:
  custo_fin  (Custo Financeiro — ZV09)
  ped        (P&D — ZV25)
  custo_fixo (Custo Fixo — ZV11)   ← ATENÇÃO: regra de MC abaixo
  scrap      (Quebra+Scrap — ZV29)

REGRA CONFIRMADA por Rafael (2026-06-23):
  TODOS entram no indPct → compõem o denominador → afetam o preço → compõem ML
  custo_fixo NÃO entra na composição de MC
  custo_fixo CANAL substitui cfixo do PRODUTO — nunca somam (exclusão mútua confirmada)
    cfixoEf = custoFixoCan > 0 ? custoFixoCan : cfixo
    cfxV = pF × cfixoEf / 100

indPct (atualizado após Fase 2):
  d.pd + cfixoEf + d.scrap + d.royal + cfVendaEf + d.frete
  + d.comis + comisXPct + d.mkt + d.rebate + pdd + vpc + vbExtra
  + footprintPct
  + d.custoFin   ← NOVO (do canal, ZV09)
  pedEf    = pedCan   > 0 ? pedCan   : pd    ← ZV25 substitui pd do produto (confirmado)
  scrapEf  = scrapCan > 0 ? scrapCan : scrap ← ZV29 substitui scrap do produto (confirmado)
```

### Normalização do Catálogo (normalizeProdutoDB)
```
Tributos: tabela PRODUTOS[] hardcoded por NCM é fonte PRIMÁRIA
Fallback: valores do catálogo (campos ipi_ios, cred_cwb, etc.)
Se NCM do produto bater com PRODUTOS[] → usa hardcoded (ignora catálogo)
```

### Constantes — NUNCA alterar sem confirmação
```
COEF_ACES_IOS   = 1.2%   ← coeficiente créditos acessórios IOS
ipiCreditoIOS   = 12.97% ← base do crédito IPI IOS (resulta em 11,28% para IPI=15%)
deságio CWB     = 35%    ← crédito outorgado PR (lei estadual)
comisXPct       = comis × (2/3)  ← encargos automáticos sobre comissão
```

### Tabela de Diferenças por Fábrica

| Aspecto | MAO ZFM CKD/SKD | IOS | CWB | CBU |
|---|---|---|---|---|
| IPI saída | 0% (isenção) | 15% por dentro | 15% | ipiIOS/ipiCWB por dentro |
| P/C base | Regime comprador (0–9,25%) | 9,25% ÷ (1+IPI%) | 9,25% | 9,25% |
| P/C subv. | 9,25% × cred% | fórmula especial | 9,25% × cred% | 0% |
| Cred. presumido | até 12% | até 12% | até 7% | 0% |
| IPI crédito | não | sim (11,28% para 15%) | não | não |
| FTI | sim (se prod.fti > 0) | não | não | não |
| ICMS | aliqInter − cred | aliqInter − cred | (aliqInter − cred) c/ 35% deságio | aliqInter (sem cred) |

---

## Estrutura do App.jsx
- Auth system (login, perfis dinâmicos, gestão de usuários)
- Calculadora tributária (tabs: Perfil, Importação, PPB, Produção, Índices, Venda, ST)
- BreakdownPanel colapsável (lado esquerdo) — MC em verde (principal), ML em azul
- ModalRegistros (salvar/carregar com pastas e subpastas)
- MultiTab (múltiplas abas de precificação)
- PainelComparativo (modal de comparação entre abas)

---

## FEATURE: Chat LLM (a implementar)

### Objetivo
Sidebar de chat onde o usuário desc