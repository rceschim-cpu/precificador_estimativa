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

REGRA CONFIRMADA (2026-07-20, fonte: PLAN_TRIB 26.03.2026): venda DENTRO do
próprio estado de origem (ufOrigem===ufDestino) usa alíquota destacada e
crédito presumido ESPECÍFICOS por NCM×UF, não a matriz interestadual MX menos
o crédito interestadual. Tabela ICMS_INTRA em src/planTrib.js (gerado por
scripts/plan_trib/extrair_dados.py). Ex.: Terminal de Pagamento/Notebook/CPU/
Smartphone/Câmera fabricados em MAO e vendidos dentro do AM → 7% destacado,
7% crédito → efetivo 0%. Não se aplica a CBU (sem benefício de fabricação).
```

### ST (Substituição Tributária) por destino
```
REGRA CONFIRMADA (2026-07-20, fonte: PLAN_TRIB 26.03.2026): MVA e alíquota
interna do ST variam por UF de DESTINO, não são um par fixo por produto.
Tabela ST_DEST em src/planTrib.js, chave "NCM|UFOrigem" → {UFdest: {mva,aliq}}.
Um useEffect no componente Calculadora sincroniza d.stAtivo/d.mva/d.icmsDestST
sempre que produto/origem/destino mudam (usuário pode sobrescrever depois — o
efeito só reage a essas 4 dependências). NCM fora da tabela mantém o
comportamento anterior (valor fixo do cadastro/perfil PRODUTOS[]).
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
aliqDest_interna = DIFAL_INT["NCM|UFdest"] (PLAN_TRIB, quando existe) senão ALIQ_INT[UFdest]
delta = aliqDest_interna − aliqInter
# REGRA CONFIRMADA (2026-07-20, fonte PLAN_TRIB): contribuinte consumidor final
# (destinacao===imobilizado) usa BASE DUPLA (gross-up, LC 190/2022):
#   delta = delta / (1 − aliqDest_interna/100)
# Não-contribuinte usa a fórmula simples (já batia com a planilha).
difal = delta > 0 ? delta : 0
# Exceção: produto com ST e delta < aliqST → difal = 0 (mantida como está —
# só alterar com confirmação do Rafael, ver docs/PLANO_TRIBUTACAO_PLAN_TRIB.md)
```

### FCP (Fundo de Combate à Pobreza)
```
REGRA CONFIRMADA (2026-07-20, fonte PLAN_TRIB 26.03.2026): FCP é por
PRODUTO×UF, não flat por UF. Tabela FCP_PROD em src/planTrib.js ("NCM" →
{UF:pct}), com fallback pro FCP={AL:1,RJ:2,SE:1} fixo (que já batia com a
planilha). Ex.: MG só cobra 2% de smartphone/feature phone/câmera, 0% do
resto; PB cobra 2% de luminárias/LED.
```

### FTI / UEA-AM
```
Aplica apenas em MAO CKD/SKD quando prod.fti > 0
Produtos com FTI: Terminal de Pagamento, Smartphone, Câmera (2,2%)
```

### Margem Gerencial
```
margGerPct SEMPRE entra no soma (sempre impacta preço e ML)

REGRA CONFIRMADA (2026-07-14): custo fixo SEMPRE entra em MC (revoga regra de 2026-06-23)

MC toggle OFF: MC = (margV + cfxV) / pF             ← cfixo entra, MG fora da MC
MC toggle ON:  MC = (margV + cfxV + margGerV) / pF  ← cfixo e MG entram

mcSugerida = margemSugerida + cfixoEf + (margGerAtivo ? margGer : 0)
mcAlvo     = margemAlvo     + cfixoEf + (margGerAtivo ? margGer : 0)

cfixo: entra no soma (indPct) → compõe o preço → afeta ML
       TAMBÉM entra no cálculo de MC (cfxV somado a margV)
       Exibido como linha informativa no BreakdownPanel abaixo de ML
```

### Índices de Canal (novos campos — Fase 2 da migração)
```
Campos novos vindos de Lista_Canais / Supabase tabela canais:
  custo_fin  (Custo Financeiro — ZV09, índice fixo por canal — distinto do CF Venda abaixo)
  ped        (P&D — ZV25)
  custo_fixo (Custo Fixo — ZV11)   ← ATENÇÃO: regra de MC acima
  scrap      (Quebra+Scrap — ZV29)

REGRA CONFIRMADA por Rafael (2026-07-14):
  TODOS entram no indPct → compõem o denominador → afetam o preço → compõem ML
  custo_fixo TAMBÉM entra na composição de MC (ver regra de Margem Gerencial acima)
  custo_fixo CANAL substitui cfixo do PRODUTO — nunca somam (exclusão mútua confirmada)
    cfixoEf = custoFixoCan > 0 ? custoFixoCan : cfixo
    cfxV = pF × cfixoEf / 100

CF Venda (Custo Financeiro de Venda) — distinto do custo_fin (ZV09) acima:
  Calculado a partir do prazo de pagamento do cliente: (1+taxa/30)^(prazo+10) - 1
  Taxa padrão 1,14% a.m. Aplicado via d.cfVenda, entra em indPct como cfVendaEf
  Agente: tool calcular_cf_venda(prazo_dias, taxa_pct) — obrigatório perguntar o prazo
  ao usuário (nunca assumir) antes de fechar uma precificação

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
REGRA CONFIRMADA (2026-07-14): Cadastro de Produtos é fonte PRIMÁRIA para tributos
(IPI/ICMS/Crédito/MVA/ST) sempre que o campo estiver preenchido (>0).
Tabela PRODUTOS[] hardcoded por NCM (~40 perfis genéricos) só cobre o que o
Cadastro deixar vazio/zerado — revoga a regra anterior onde PRODUTOS[] sempre
vencia. Motivo: PRODUTOS[] representa um NCM inteiro (ex: "Smart Plug WiFi"),
mas produtos diferentes podem compartilhar NCM com tributação real distinta
(ex: BOTAO DE SOBREPOR/EMBUTIR, NCM 8536.50.90, IPI_CWB real 9,75% vs perfil
genérico 3,25%).
Campos de produção/garantia/BKP/embalagem/P&D/scrap/royalties/frete/mkt/rebate/
margem gerencial vêm SEMPRE do Cadastro — não existem na tabela PRODUTOS[].
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
Sidebar de chat onde o usuário descreve o cenário em linguagem natural e o LLM preenche os campos da calculadora via tool calls.

Exemplo: "precifica o Notebook Celeron 14 pra T3 SP, custo USD 320, dólar 5,85, margem 12%"
→ LLM chama set_produto, set_canal, set_custo, set_uf, set_margem automaticamente.

### Variável de ambiente
```
VITE_CLAUDE_KEY=sk-ant-...   (configurar no Vercel + .env.local)
```

### Modelo
```
claude-haiku-4-5-20251001   ← rápido e barato; suficiente para tool calls simples
```

### API endpoint
```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: import.meta.env.VITE_CLAUDE_KEY
  anthropic-version: 2023-06-01
  content-type: application/json
```

### SYSTEM PROMPT do agente (usar literalmente)
```
Você é o assistente de precificação da Positivo Tecnologia.
Sua função é preencher os campos da calculadora tributária com base no que o usuário descreve.

REGRAS OBRIGATÓRIAS:
- Use SEMPRE as ferramentas disponíveis para preencher os campos — nunca responda só com texto quando puder agir.
- Após preencher os campos, chame get_resultado para mostrar o preço calculado.
- Percentuais: "2%" ou "2" → passe 2 (nunca 0.02).
- Se o usuário mencionar produto ambíguo (ex: "notebook" sem modelo), pergunte BU/modelo antes de chamar set_produto.
- Não recalcule manualmente tributos — a calculadora faz isso; use get_resultado.
- Se faltar alguma informação obrigatória (custo ou produto), pergunte antes de agir.
- Formato de valores monetários: R$ com 2 casas decimais.
- Seja direto. Confirme o que foi preenchido em uma linha.

CONTEXTO DA CALCULADORA (injetado dinamicamente):
{CONTEXT}
```

O placeholder `{CONTEXT}` é substituído em runtime pela função `buildCalcContext(d, prod, canais)` que serializa o estado atual da calculadora.

### Tools (CALC_TOOLS)
```js
const CALC_TOOLS = [
  {
    name: "set_produto",
    description: "Seleciona o produto na calculadora pelo ID do catálogo",
    input_schema: {
      type: "object",
      properties: {
        produto_id: { type: "string", description: "ID do produto em produtos_catalogo" }
      },
      required: ["produto_id"]
    }
  },
  {
    name: "set_origem_modalidade",
    description: "Define fábrica de origem e modalidade de importação",
    input_schema: {
      type: "object",
      properties: {
        origem:     { type: "string", enum: ["MAO","IOS","CWB"] },
        modalidade: { type: "string", enum: ["CKD","SKD","CBU"] }
      },
      required: ["origem","modalidade"]
    }
  },
  {
    name: "set_canal",
    description: "Seleciona canal de venda",
    input_schema: {
      type: "object",
      properties: {
        canal_id: { type: "string", description: "ID do canal (ex: 't3', 'corp', 'amzn')" }
      },
      required: ["canal_id"]
    }
  },
  {
    name: "set_custo",
    description: "Define custo do produto",
    input_schema: {
      type: "object",
      properties: {
        vpl_usd:  { type: "number", description: "Custo em USD (VPL)" },
        dolar:    { type: "number", description: "Taxa do dólar (ptax)" },
        producao: { type: "number", description: "Custo de produção/transformação em R$" }
      }
    }
  },
  {
    name: "set_uf_destino",
    description: "Define UF de destino (para cálculo de ICMS e DIFAL)",
    input_schema: {
      type: "object",
      properties: {
        uf: { type: "string", description: "Sigla do estado (ex: SP, RJ, MG)" }
      },
      required: ["uf"]
    }
  },
  {
    name: "set_margem",
    description: "Define margem líquida alvo (ML%)",
    input_schema: {
      type: "object",
      properties: {
        margem: { type: "number", description: "Percentual de margem líquida" }
      },
      required: ["margem"]
    }
  },
  {
    name: "set_indices",
    description: "Sobrescreve índices comerciais específicos da aba ativa",
    input_schema: {
      type: "object",
      properties: {
        rebate:   { type: "number" },
        mkt:      { type: "number" },
        frete:    { type: "number" },
        vpc:      { type: "number" },
        pdd:      { type: "number" },
        comis:    { type: "number" }
      }
    }
  },
  {
    name: "get_resultado",
    description: "Retorna o preço calculado atual (pF, ML%, MC%, markup). Chamar sempre ao final para mostrar o resultado ao usuário.",
    input_schema: { type: "object", properties: {} }
  }
]
```

### Implementação do ChatPanel
- Componente `ChatPanel({ d, setD, c, produtosDB, canais, onClose })`
- Estado local: `messages` (array de {role, content}), `loading` (bool)
- `buildCalcContext(d, prod, canais)` → string com produto atual, canal, custo, UF, índices
- `handleToolCall(name, input)` → executa a tool e retorna resultado:
  - `set_produto` → busca em produtosDB pelo ID, chama `normalizeProdutoDB`, seta prod
  - `set_origem_modalidade` → `setD(p=>({...p, origem, modalidade}))`
  - `set_canal` → carrega taxas do canal e seta todos os campos de índice
  - `set_custo` → `setD(p=>({...p, fobUSD: vpl_usd, ptax: dolar, ...}))`
  - `set_uf_destino` → `setD(p=>({...p, ufDestino: uf}))`
  - `set_margem` → `setD(p=>({...p, margem}))`
  - `set_indices` → `setD(p=>({...p, ...input}))`
  - `get_resultado` → retorna `{ pF: c.pF, ml: c.margPct, mc: c.mc, markup: c.mkp }`
- Loop agentic: após tool_use, adiciona tool_result e chama API novamente até stop_reason === "end_turn"
- UI: sidebar direita, 380px, histórico scrollável, input na base

### Campos de `d` (estado da calculadora) relevantes para os setters
```
d.fobUSD      → custo USD (VPL)
d.ptax        → dólar de custo
d.producao    → custo transformação R$
d.origem      → "MAO" | "IOS" | "CWB"
d.modalidade  → "CKD" | "SKD" | "CBU"
d.ufDestino   → sigla UF
d.margem      → ML% alvo
d.comis, d.mkt, d.rebate, d.pdd, d.vpc, d.frete  → índices comerciais
```
