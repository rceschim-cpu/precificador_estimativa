# Lógica de Cálculo — Precificador Positec

> Extraído do código-fonte `src/App.jsx` em 2026-05-11.  
> Nomes técnicos preservados para uso como vocabulário de agente conversacional.  
> **Não simplificado.** Todas as fórmulas são fiéis ao código.

---

## 1. Variáveis de entrada

### 1.1 Produto e origem

| Nome técnico | Nome amigável | Tipo / unidade | Observação |
|---|---|---|---|
| `prodId` | Produto | string (id do catálogo) | Obrigatório |
| `origem` | Fábrica | `"MAO"` \| `"IOS"` \| `"CWB"` | Default: `"MAO"` |
| `modalidade` | Modalidade | `"CKD"` \| `"SKD"` \| `"CBU"` | Default: `"CKD"` |
| `ufDestino` | UF de destino da venda | sigla (AC…TO) | Default: `"SP"` |

### 1.2 Importação

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `fobUSD` | Custo FOB | USD | 0 |
| `freteUSD` | Frete internacional | USD | 0 |
| `ptax` | PTAX (câmbio USD→BRL) | BRL/USD | 5,31 |
| `seguroBRL` | Seguro (importação) | BRL | 0 |
| `aliqII` | Alíquota II (Imposto de Importação) | % | 0 (auto-preenchido para CBU via TEC_II) |
| `despesas` | Despesas aduaneiras (valor absoluto) | BRL | 0 |
| `despesasPct` | Despesas aduaneiras (percentual do CFR BRL) | % | 0 |
| `despesasModo` | Modo das despesas | `"pct"` \| `"brl"` | `"pct"` |
| `cfImp` | Crédito Federal (IOS) | BRL | 0 |
| `cra` | CRA — Crédito Regional Amazônico (MAO) | BRL (negativo = crédito) | 0 |
| `conteudoLocal` | Conteúdo local (%) | % | 0 |
| `plmPct` | % PLM do CFR (base placa IOS) | % | 0 |

### 1.3 PPB — itens de produção local

| Nome técnico | Nome amigável | Tipo | Default |
|---|---|---|---|
| `ppbAtivos.injecao` | Injeção Plástica | boolean | false |
| `ppbAtivos.bateria` | Bateria | boolean | false |
| `ppbAtivos.carregador` | Carregador | boolean | false |
| `ppbAtivos.memoria` | Memória | boolean | false |
| `ppbAtivos.cabo` | Cabo | boolean | false |
| `ppbAtivos.placa` | Produção da Placa (PCB) | boolean | false |
| `ppbVals.{item}` | Custo BRL de cada item ativo | BRL | 0 |

### 1.4 Custos de produção / operação

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `producao` | Custo de produção | BRL | 0 |
| `garantia` | Garantia | BRL | 0 |
| `bkpPct` | BKP (backup/reposição) | % sobre VPL+emb+outros | 0 (pad. por produto) |
| `embalagem` | Embalagem | BRL | 0 |
| `outrosBRL` | Outros custos (BRL) | BRL | 0 |

### 1.5 Modo de cálculo do VPL

| Nome técnico | Valor | Significado |
|---|---|---|
| `vplModo` | `"estimado"` | VPL = CFR BRL + II + Despesas + cfImp + ppbTot + CRA |
| `vplModo` | `"manual"` | VPL = `vplManual` (digitado manualmente) |
| `vplModo` | `"padrao"` | VPL = `produtoDB.vpl_padrao` (valor padrão do cadastro) |
| `vplManual` | — | BRL | 0 |

### 1.6 Índices de venda

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `pd` | P&D | % | 0 (pad. por origem) |
| `cfixo` | Custo Fixo | % | 0 (pad. por produto) |
| `scrap` | Scrap | % | 0 (pad. por produto) |
| `royal` | Royalties | % | 0 (pad. por produto) |
| `frete` | Frete de venda | % | 0 (pad. por produto) |
| `royalModo` | Modo dos royalties | `"pct"` \| `"usd"` | `"pct"` |
| `royalUSD` | Royalties em USD (converte para %) | USD | 0 |

### 1.7 Venda e canal

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `comis` | Comissão | % | 0 |
| `mkt` | Marketing / Verba | % | 0 |
| `rebate` | Rebate | % | 0 |
| `pdd` | PDD (provisão devedores duvidosos) | % | 2,5 |
| `vbExtra` | Verba extra | % | 0 |
| `vpc` | VPC (verba por canal) | % | 0 |
| `cfVenda` | Custo financeiro de venda | % | 0 |
| `cartaoAtivo` | Cartão de crédito ativo | boolean | false (+2% quando true) |
| `canalId` | Canal comercial | string (id do canal) | `""` (vazio) |

### 1.8 Regime e tipo de comprador

| Nome técnico | Valores | Default |
|---|---|---|
| `regimeVendedor` | `"real"` (Lucro Real) \| `"presumido"` (Lucro Presumido) | `"real"` |
| `pcZfmKey` | Regime P/C ZFM (MAO): `"dentro_zmf"` / `"nao_cumulativo"` / `"cumulativo"` / `"outros"` | `"nao_cumulativo"` |
| `tipoComprador` | `"contrib"` (contribuinte ICMS) \| `"naocontrib"` | `"contrib"` |
| `destinacaoCliente` | `"revenda"` \| `"imobilizado"` \| `"consumo"` | `"revenda"` |

### 1.9 Margem

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `margem` | Margem Líquida (ML) alvo | % | 0 |
| `margGer` | Margem Gerencial/Agnóstica | % (pode ser negativo) | 0 |
| `margGerAtivo` | Impactar MC com Margem Gerencial | boolean | false |

### 1.10 Modo de cálculo

| Nome técnico | Valores | Significado |
|---|---|---|
| `modoCalc` | `"preco"` | Calcula pF a partir de margem+custos |
| `modoCalc` | `"margem"` | Calcula ML a partir de `precoSugerido` |
| `precoAlvo` | BRL | Calcula `margemAlvo` retroativamente |
| `precoSugerido` | BRL | Usado como pF base no modo `"margem"` |

### 1.11 Substituição Tributária (ST)

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `stAtivo` | ST ativa | boolean | false |
| `mva` | MVA (margem de valor agregado) | % | por produto |
| `icmsDestST` | Alíquota ICMS destino p/ ST | % | 18 |

### 1.12 CBU — campos específicos

| Nome técnico | Nome amigável | Unidade | Default |
|---|---|---|---|
| `icmsDiferimento` | % de diferimento de ICMS | % | 0 |
| `ptaxPreco` | PTAX para conversão USD do preço | BRL/USD | 0 (usa `ptax` se 0) |
| `moedaCusto` | Moeda do custo | `"BRL"` \| `"USD"` | `"BRL"` |

---

## 2. Variáveis derivadas / intermediárias

A ordem abaixo respeita a dependência entre os cálculos.

### 2.1 Resolução dos atributos do produto (`getProdAtributos`)

```
isCBU  = (modalidade === "CBU")
isZFM  = (origem.zmf === true) && !isCBU

ipi    = isCBU
           ? (prod.ipiIOS || prod.ipiCWB || prod["ipi"+origem] || 0)
           : prod["ipi"+origem]

pcBase = isZFM ? "zmf" : 9.25          // indica regime P/C

icms   = prod["icms"+origem]            // alíquota ICMS origem (saída de fábrica)

cred   = isCBU ? 0 : prod["cred"+origem]   // crédito presumido ICMS

fti    = isZFM && !isCBU ? prod.fti : 0    // FTI/UEA-AM (% sobre pF)
```

> **Regra**: crédito presumido (`cred`) é benefício de **fabricação** — CBU não tem.

### 2.2 CMV (Custo da Mercadoria Vendida)

```
cfrUSD        = fobUSD + freteUSD
cfrBRL        = cfrUSD × ptax

iiV           = cfrBRL × (aliqII / 100)
iiUSD         = iiV / ptax

despesas      = (despesasModo === "pct") ? cfrBRL × despesasPct/100 : despesas
cfrImp        = cfrBRL + iiV + despesas
cmvImp        = cfrBRL + iiV + despesas + seguroBRL

ppbTot        = isCBU ? 0 : Σ (ppbVals[i] para cada ppbAtivos[i] ativo)

vplEstimado   = cmvImp + cfImp + ppbTot + cra
vpl           = vplModo==="estimado" ? vplEstimado
              : vplModo==="manual"   ? vplManual
              :                        produtoDB.vpl_padrao

bkpBase       = vpl + embalagem + outrosBRL
bkpV          = bkpBase × (bkpPct / 100)

cmvTotal      = vpl + producao + garantia + bkpV + embalagem + outrosBRL
```

> `cmvTotal` é a base do denominador — **tudo que precisa ser recuperado no preço**.

### 2.3 Créditos especiais de importação

**CRA — MAO (crédito regional amazônico):**
```
craCalcMAO = (origem === "MAO")
  ? -((conteudoLocal/100) × iiUSD)
  : 0
```
> Valor em USD, negativo = crédito. Inserido diretamente em `cra` (campo BRL).

**Crédito Federal — IOS:**
```
cfImpUSD         = cfImp / ptax
despesasUSD      = despesas / ptax
seguroUSD        = seguroBRL / ptax
cfrExpandidoUSD  = fobUSD + freteUSD + iiUSD + despesasUSD + cfImpUSD + seguroUSD

ppbPlacaUSD      = ppbVals.placa / ptax
ppbMemoriaUSD    = ppbVals.memoria / ptax
basePlacaUSD     = (plmPct/100 × cfrExpandidoUSD) + ppbPlacaUSD + ppbMemoriaUSD

creditoCalcIOS   = (origem === "IOS")
  ? (-ipi/100 + icms/100 × 0.073) × basePlacaUSD × (1 + conteudoLocal/100)
  : 0
```
> Calculado como referência informacional; inserido manualmente em `cfImp`.

### 2.4 IPI efetivo

```
ipiEfPct = (origem === "IOS" || isCBU) && ipi > 0
  ? ipi / (1 + ipi/100)     // "por dentro"
  : ipi                      // MAO CKD/SKD → 0
```
> Exemplo: IPI=15% → ipiEfPct = 15/1,15 = **13,04%**

### 2.5 Fator IPI (ipiF)

```
ipiF = (origem === "IOS") && ipi > 0 ? (1 + ipi/100) : 1
```
> Converte percentuais calculados sobre pF para a base pSI no denominador.  
> MAO/CWB têm IPI=0 → ipiF=1, sem efeito.

### 2.6 P/C base (pcPct)

```
se isZFM e pcBase === "zmf":
  pcPct  = PC_ZFM[pcZfmKey].pct        // 0%, 3,65%, 7,30% ou 9,25%
  pcLabel = "ZFM X%"

senão se pcBase é número:
  pcPct  = pcBase                       // sempre 9,25 no código atual para não-ZFM

senão:
  pcPct  = (regimeVendedor === "presumido") ? 3.65 : 9.25
```

**Tabela PC_ZFM (MAO CKD/SKD apenas):**

| Chave (`pcZfmKey`) | Regime do comprador | P/C (%) | Base legal |
|---|---|---|---|
| `dentro_zmf` | Comprador dentro da ZFM | 0,00 | Despacho MF S/N 13.11.2017 |
| `nao_cumulativo` | Lucro Real 100% não-cumulativo | 3,65 | Lei 10.637/02 art. 2º §4º I,b |
| `cumulativo` | Lucro Presumido / Simples / Misto | 7,30 | Lei 10.637/02 art. 2º §4º II |
| `outros` | ONG / PF fora da ZFM | 9,25 | Lei 10.637/02 art. 2º caput |

### 2.7 Alíquota ICMS interestadual (`aliqInter`)

```
aliqInter = getICMS(ufOrigemFabrica, ufDestino)
          = MX[ufO][indexOf(ufD)]     // se ufO === ufD → ALIQ_INT[ufD] (interna)
```
> Matriz `MX` 27×27 (UF origem × UF destino). Alíquota padrão interestadual: 12%.  
> Exceções notáveis: MG, PR, RJ, RS, SC, SP enviam a 7% para estados do Sul/Sudeste.

### 2.8 Alíquota ICMS destino interna (`aliqDest`)

```
aliqDest = ALIQ_INT[ufDestino]   // alíquota interna do estado de destino
```

### 2.9 ICMS efetivo de saída da fábrica (`icmsOrigemEf`, `icmsImpEf`)

```
icmsOrigemEf = (uf_fábrica === "PR")
  ? icms × (1 - 0.35)    // deságio 35% — crédito outorgado PR (lei estadual)
  : icms

icmsImpEf    = isCBU
  ? icms × (1 - icmsDiferimento/100)   // diferimento editável
  : icmsOrigemEf
```
> CWB/PR: `icmsOrigemEf` = 12% × 0,65 = **7,8%** efetivo (para icms=12%).

### 2.10 ICMS efetivo no denominador (`icmsEfPct`)

```
icmsEfPct = max(0, aliqInter - cred)
```
> Se crédito presumido absorve o ICMS interestadual → icmsEfPct = 0.  
> Exemplo MAO→SP: aliqInter=12%, cred=12% → icmsEfPct=**0%**.  
> Exemplo IOS→SP: aliqInter=12%, cred=12% → icmsEfPct=**0%** também.

### 2.11 DIFAL (`difal`)

```
deveDifal = (tipoComprador === "naocontrib")
         || (tipoComprador === "contrib" && destinacaoCliente === "imobilizado")

se não intra-UF e deveDifal:
  delta = aliqDest - aliqInter
  se delta > 0:
    difal = (aliqST > 0 && delta < aliqST) ? 0 : delta
  senão:
    difal = 0
senão:
  difal = 0
```
> Intra-UF: `difal = 0` sempre.  
> Revenda B2B (contribuinte, destino revenda): `difal = 0`.

### 2.12 FCP — Fundo de Combate à Pobreza (`fcpPct`)

```
fcpPct = FCP[ufDestino] || 0
```

| UF | FCP |
|---|---|
| AL | 1% |
| MG | 1% |
| RJ | 2% |
| SE | 1% |
| Demais | 0% |

### 2.13 FTI / UEA-AM (`ftiPct`)

```
ftiPct = (isZFM && ftiAtivo) ? prodAtrib.fti : 0
```
> Aplica apenas para MAO CKD/SKD quando o produto tem `fti > 0`.  
> Produtos com FTI: Terminal de Pagamento (2,2%), Smartphone (2,2%), Câmera (2,2%).

### 2.14 P/C efetivo (`pcEf`)

```
pcEfBase = pcPct × (1 - (aliqInter + difal) / 100)

pcEf = (origem === "IOS") && ipi > 0
  ? pcEfBase / (1 + ipi/100)     // base IOS exclui IPI
  : pcEfBase
```

### 2.15 P/C subvenção (`pcSubvPct`)

```
COEF_ACES_IOS = 1.2   // coeficiente de créditos acessórios IOS (calibrado)

se origem === "IOS" e ipi > 0 e cred > 0:
  pcSubvPct = max(0, 9.25 × (cred/100/(1+ipi/100) - COEF_ACES_IOS/100))

senão se cred > 0:
  pcSubvPct = 9.25 × (cred / 100)

senão:
  pcSubvPct = 0
```
> `pcSubvPct` é **CUSTO**, não economia. Entra no `soma` somando (aumenta denominador → eleva preço).

### 2.16 Crédito IPI IOS (`ipiCreditoIOSPct`)

```
ipiCreditoIOSPct = (origem === "IOS") && ipi > 0
  ? 12.97 / (1 + ipi/100)
  : 0
```
> Exemplo: IPI=15% → 12,97/1,15 = **11,28%** (entra como **negativo** no `soma`).  
> ⚠️ Não usar `ipi/(1+ipi/100)` — daria 13,04% (errado).

### 2.17 Comissão com encargos (`comisXPct`)

```
comisXPct = comis × (2/3)
```
> Encargo automático sobre comissão.

### 2.18 Custo financeiro de venda efetivo (`cfVendaEf`)

```
cartaoPct  = cartaoAtivo ? 2 : 0
cfVendaEf  = cfVenda + cartaoPct
```

### 2.19 Footprint da fábrica (`footprintPct`)

```
footprintPct = !isCBU ? oRef.footprint : 0
```

| Origem | Footprint |
|---|---|
| MAO | -0,71% (benefício ZFM) |
| IOS | +1,00% (custo extra Ilhéus) |
| CWB | 0,00% |

> CBU: sempre 0% (não é produção nacional).

### 2.20 Índice de venda total (`indPct`)

```
indPct = pd + cfixo + scrap + royal + cfVendaEf + frete
       + comis + comisXPct + mkt + rebate + pdd + vbExtra + vpc
       + footprintPct
```

### 2.21 Soma do denominador (`soma`)

```
soma = ipiF × (
  pcEf + pcSubvPct + icmsEfPct + difal
  + ftiPct + fcpPct + indPct + margGerPct + margem
  - ipiCreditoIOSPct
) / 100
```

> Todos os percentuais são sobre pF (preço final c/ IPI).  
> `ipiF` converte para base pSI (sem IPI).  
> `ipiCreditoIOSPct` entra **negativo** → reduz o soma → eleva o preço.

### 2.22 Preço Sell-In sem IPI (`pSI`)

```
pSI = soma < 1 ? cmvTotal / (1 - soma) : cmvTotal × 99
```
> Proteção: se `soma ≥ 1` (custos maiores que 100% do preço), retorna valor artificialmente alto.

### 2.23 Preço com IPI (`pCI`) e preço final (`pF`)

```
ipiV  = pSI × (ipi / 100)
pCI   = pSI + ipiV

// ST:
se stAtivo e mva > 0:
  stBase = pCI × (1 + mva/100)
  stV    = max(0, stBase × (icmsDestST/100) - icmsV)
senão:
  stV    = 0

pF = pCI + stV
```

---

## 3. Fórmula da margem

### 3.1 Margem Líquida (`margPct` / `margV`)

No modo `"preco"` (padrão):
```
margem     = input direto (%)
margV      = pF × (margem / 100)
```

No modo `"margem"` (preço sugerido → calcula ML):
```
pSIs         = precoSugerido / (1 + ipi/100)
sfBase2      = pcEf + pcSubvPct + icmsEfPct + difal + ftiPct + fcpPct
             + indPct + margGerPct - ipiCreditoIOSPct
margemSugerida = (1 - cmvTotal/pSIs) × 100 / ipiF - sfBase2
```

### 3.2 Margem de contribuição (`mc`)

```
mc = pF > 0
  ? ((margV + cfxV + (margGerAtivo ? margGerV : 0)) / pF) × 100
  : 0
```

### 3.3 Margem Gerencial (`margGerPct`, `margGerV`)

```
margGerPct = margGer                         // input; pode ser negativo
margGerV   = pF × (margGerPct / 100)
```

> `margGerPct` **sempre** entra no `soma` (impacta pF independente do toggle).  
> O toggle `margGerAtivo` só controla se MG **entra na MC** ou fica abaixo da linha.

### 3.4 Margem alvo (reversa)

```
pSIa       = precoAlvo / (1 + ipi/100)
sfBase     = pcEf + pcSubvPct + icmsEfPct + difal + ftiPct + fcpPct
           + indPct + margGerPct - ipiCreditoIOSPct
margemAlvo = pSIa > 0
  ? (1 - cmvTotal/pSIa) × 100 / ipiF - sfBase
  : null
```

### 3.5 MC equivalente (com ML + CF ± MG)

```
mcSugerida = margemSugerida + cfixo + (margGerAtivo ? margGer : 0)
mcAlvo     = margemAlvo     + cfixo + (margGerAtivo ? margGer : 0)
```

### 3.6 Markup

```
mkp = cmvTotal > 0 ? pF / cmvTotal : 0
```

### 3.7 Carga tributária total

```
cargaTot = pcV + ipiV + icmsEfV + difalV + stV + fcpV
cargaPct = (cargaTot / pF) × 100
```

---

## 4. Regras por planta

### MAO — Manaus/AM (ZFM)

- **ZFM**: `zmf = true` → aplica regime especial P/C
- **IPI**: isenção Lei 8.387/91 → `ipiMAO = 0` para todos os produtos fabricados (CKD/SKD)
- **P/C**: regime do **comprador** via `PC_ZFM` (0%, 3,65%, 7,30% ou 9,25%)
- **P/C subvenção**: `pcSubvPct = 9,25% × cred%`
- **Crédito presumido**: `cred` ativo (até 12%) → `icmsEfPct = max(0, aliqInter - cred)`
- **FTI**: aplica quando `ftiAtivo=true` e produto tem `fti > 0`
- **Crédito IPI IOS**: não aplica (`ipiCreditoIOSPct = 0`)
- **Footprint**: -0,71% (benefício operacional ZFM)
- **CRA**: campo de crédito específico MAO (`conteudoLocal × iiUSD`)

### IOS — Ilhéus/BA

- **ZFM**: false → P/C = 9,25% (Lucro Real) ou 3,65% (Presumido)
- **IPI**: até 15% "por dentro" → `ipiEfPct = ipi/(1+ipi/100)`
- **P/C efetivo**: `pcEfBase / (1+ipi/100)` — base exclui IPI
- **P/C subvenção**: fórmula especial com `COEF_ACES_IOS = 1,2%`
  - `pcSubvPct = max(0, 9,25% × (cred/100/(1+ipi/100) - 0,012))`
- **Crédito IPI IOS**: `12,97% / (1+ipi/100)` — entra negativo no soma
- **FTI**: não aplica
- **Footprint**: +1,00% (custo extra operacional Ilhéus)
- **Crédito Federal (cfImp)**: campo exclusivo IOS

### CWB — Curitiba/PR

- **ZFM**: false → P/C = 9,25% ou 3,65%
- **IPI**: mesmas alíquotas de IOS (15% para notebooks, etc.)
- **P/C subvenção**: `pcSubvPct = 9,25% × cred%` (sem divisão por IPI)
- **Crédito presumido**: até 7% (menor que MAO/IOS)
- **Deságio ICMS PR**: `icmsOrigemEf = icms × (1 - 0,35)` — crédito outorgado lei estadual PR
  - Ex: icms=12% → icmsOrigemEf = **7,8%**
- **Crédito IPI IOS**: não aplica
- **FTI**: não aplica
- **Footprint**: 0%

### CBU — Produto acabado importado (qualquer origem)

- **ZFM**: nunca (isCBU=true cancela ZFM)
- **IPI**: usa alíquota cheia (`ipiIOS || ipiCWB`) — não tem isenção
- **P/C**: 9,25% (Lucro Real) ou 3,65% (Presumido) — sem regime ZFM
- **P/C subvenção**: **0%** (crédito presumido é de fabricação, não de importação)
- **Crédito presumido** (`cred`): **0%** sempre
- **ICMS**: `icmsImpEf = icms × (1 - icmsDiferimento/100)` — diferimento editável
- **FTI**: 0%
- **Footprint**: 0%
- **PPB**: não aplica (`ppbTot = 0`)
- **II (TEC_II)**: preenchido automaticamente por NCM ao selecionar CBU

---

## 5. Regras condicionais

### 5.1 IPI

| Condição | Resultado |
|---|---|
| `origem === "MAO"` e CKD/SKD | `ipi = 0` (isenção ZFM) |
| `origem === "IOS"` ou CBU | `ipi = alíquota cheia`; cálculo "por dentro" |
| `origem === "CWB"` | `ipi = alíquota cheia`; cálculo "por dentro" |

### 5.2 P/C

| Condição | pcPct |
|---|---|
| MAO CKD/SKD e `pcZfmKey=dentro_zmf` | 0% |
| MAO CKD/SKD e `pcZfmKey=nao_cumulativo` | 3,65% |
| MAO CKD/SKD e `pcZfmKey=cumulativo` | 7,30% |
| MAO CKD/SKD e `pcZfmKey=outros` | 9,25% |
| Não-ZFM e `regimeVendedor=presumido` | 3,65% |
| Não-ZFM e `regimeVendedor=real` | 9,25% |

### 5.3 DIFAL

| Condição | difal |
|---|---|
| Intra-UF (origem = destino) | 0 |
| `tipoComprador=contrib` e `destinacaoCliente=revenda` | 0 |
| `tipoComprador=naocontrib` (qualquer destino) | delta = `aliqDest - aliqInter` se delta > 0 |
| `tipoComprador=contrib` e `destinacaoCliente=imobilizado` | idem |
| Produto com ST e `delta < aliqST` | 0 (exceção) |

### 5.4 ICMS CWB (deságio 35%)

```
se uf_fábrica === "PR":
  icmsOrigemEf = icms × 0.65
senão:
  icmsOrigemEf = icms
```

### 5.5 CBU — diferimento ICMS

```
icmsImpEf = isCBU ? icms × (1 - icmsDiferimento/100) : icmsOrigemEf
```
> Campo editável; permite reduzir ICMS efetivo por ato legal específico.

### 5.6 ST (Substituição Tributária)

```
se stAtivo && mva > 0:
  stBase = pCI × (1 + mva/100)
  icmsV  = pSI × (aliqInter/100)     // ICMS da operação própria
  stV    = max(0, stBase × (icmsDestST/100) - icmsV)
```

### 5.7 Modo de cálculo

| `modoCalc` | O que entra como input | O que é calculado |
|---|---|---|
| `"preco"` | `margem` (ML%) | pSI → pCI → pF |
| `"margem"` | `precoSugerido` (BRL) | `margemSugerida` (ML%) |

> No modo `"margem"`: todos os valores monetários são recalculados sobre `precoSugerido`.

### 5.8 Footprint

```
footprintPct = !isCBU ? oRef.footprint : 0
```
> CBU nunca aplica footprint (não é operação de fabricação nacional).

---

## 6. Toggles e modos

### 6.1 Toggle Margem Gerencial (`margGerAtivo`)

- **`margGerAtivo = false`** (OFF):
  - `margGerPct` entra no `soma` → impacta pF
  - `mc = (margV + cfxV) / pF` → MG **não** compõe a MC
  - MG aparece "abaixo da linha" no breakdown

- **`margGerAtivo = true`** (ON):
  - `margGerPct` entra no `soma` → impacta pF (igual ao OFF)
  - `mc = (margV + cfxV + margGerV) / pF` → MG **entra** na MC
  - `mcSugerida = margemSugerida + cfixo + margGer`
  - `mcAlvo = margemAlvo + cfixo + margGer`

> Em ambos os estados, `margGerPct` **sempre impacta o preço**.

### 6.2 Toggle ST (`stAtivo`)

- OFF: `stV = 0`, `pF = pCI`
- ON (com `mva > 0`): calcula ST pelo MVA do produto e `icmsDestST`

### 6.3 Toggle Cartão (`cartaoAtivo`)

- OFF: `cartaoPct = 0`
- ON: `cartaoPct = 2%` (adicionado a `cfVendaEf`)

### 6.4 Toggle FTI (`ftiAtivo`)

- OFF: `ftiPct = 0`
- ON (e isZFM e produto tem fti > 0): `ftiPct = prodAtrib.fti`

### 6.5 Modo VPL (`vplModo`)

| Valor | Fórmula do VPL |
|---|---|
| `"estimado"` | `cmvImp + cfImp + ppbTot + cra` |
| `"manual"` | `vplManual` |
| `"padrao"` | `produtoDB.vpl_padrao` |

### 6.6 Modo royalties (`royalModo`)

- `"pct"`: `royal` = percentual direto
- `"usd"`: `royal` calculado como `(royalUSD × ptax / pSI) × 100` (convertido para %)

---

## 7. Constantes e parâmetros default

### 7.1 Constantes calibradas — nunca alterar sem confirmação de Rafael

| Constante | Valor | Uso |
|---|---|---|
| `COEF_ACES_IOS` | 1,2% | Coeficiente de créditos acessórios IOS na fórmula pcSubvPct |
| `ipiCreditoIOS` base | 12,97% | Base fixa do crédito IPI IOS (÷ (1+IPI%) = crédito efetivo) |
| Deságio CWB | 35% | Crédito outorgado PR (lei estadual) |
| `comisXPct` | `comis × 2/3` | Encargos automáticos sobre comissão |
| Cartão de crédito | 2% (quando ativo) | Adicionado ao `cfVendaEf` |

### 7.2 Defaults do formulário (`DEF`)

```js
prodId: "pos", origem: "MAO", modalidade: "CKD"
pcZfmKey: "nao_cumulativo"    // P/C ZFM: Lucro Real 3,65%
regimeVendedor: "real"         // P/C não-ZFM: 9,25%
tipoComprador: "contrib"
destinacaoCliente: "revenda"
ufDestino: "SP"
ptax: 5.31
pdd: 2.5                       // PDD padrão 2,5%
icmsDiferimento: 0
stAtivo: false
mva: 0
icmsDestST: 18
modoCalc: "preco"
margGer: 0
margGerAtivo: false
cartaoAtivo: false
vplModo: "estimado"
```

### 7.3 Footprints por origem

| Origem | Footprint |
|---|---|
| MAO | -0,71% |
| IOS | +1,00% |
| CWB | 0,00% |

### 7.4 P&D padrão por origem

| Origem | pdPad |
|---|---|
| MAO | 2,55% |
| IOS | 3,48% |
| CWB | 3,48% |

### 7.5 CANAIS — taxas padrão

| Canal | comis | mkt | rebate | pdd | vpc |
|---|---|---|---|---|---|
| T1/T2 Varejo | 0% | 1,50% | 3,00% | 2,5% | 0% |
| T3 / Distribuidor | 0,98% | 1,50% | 1,65% | 2,5% | 0% |
| Corporativo | 2,98% | 1,40% | 0% | 2,5% | 0% |
| Amazon | 3,25% | 3,74% | 1,00% | 2,5% | 5,84% |
| MercadoLivre | 2,17% | 4,00% | 1,00% | 2,5% | 3,70% |
| Magazine Luiza | 0% | 1,50% | 1,00% | 2,5% | 0% |
| Casas Bahia | 0% | 1,50% | 1,00% | 2,5% | 0,30% |
| Americanas | 0% | 1,50% | 1,00% | 2,5% | 2,00% |
| Carrefour | 0% | 1,50% | 1,00% | 2,5% | 7,81% |
| Cencosud | 0% | 1,50% | 1,00% | 2,5% | 4,20% |
| Leroy Merlin | 3,25% | 2,00% | 1,00% | 2,5% | 3,20% |
| Telefônica/TIM | 2,44% | 2,00% | 1,00% | 2,5% | 5,40% |
| Venda Direta | 0% | 1,50% | 0% | 2,5% | 0% |
| PosiSeg B2B | 0% | 4,00% | 0% | 2,5% | 0% |

### 7.6 FCP por UF

| UF | FCP |
|---|---|
| AL | 1% |
| MG | 1% |
| RJ | 2% |
| SE | 1% |

### 7.7 Tabela de tributos por produto (hardcoded por NCM)

Fonte primária. Catálogo é apenas fallback se NCM não constar nesta tabela.

| Produto | NCM | ipiMAO | ipiIOS | ipiCWB | credMAO | credIOS | credCWB | icmsMAO | icmsIOS | icmsCWB | fti |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Terminal de Pagamento | 8470.50.10 | 0 | 0 | 0 | 12 | 0 | 0 | 12 | 12 | 4 | 2,2% |
| Notebook 8"–14" | 8471.30.12 | 0 | 15 | 15 | 12 | 12 | 7 | 12 | 12 | 7 | 0 |
| Notebook 15"+ | 8471.30.19 | 0 | 15 | 15 | 12 | 12 | 7 | 12 | 12 | 7 | 0 |
| Tablet 7" | 8471.30.11 | 0 | 15 | 15 | 12 | 12 | 7 | 12 | 12 | 7 | 0 |
| CPU Pequena Cap. | 8471.50.10 | 0 | 9,75 | 9,75 | 12 | 12 | 4 | 12 | 12 | 4 | 0 |
| All In One / Servidor | 8471.49.00 | 0 | 9,75 | 9,75 | 12 | 12 | 4 | 12 | 12 | 4 | 0 |
| Smartphone | 8517.13.00 | 0 | 15 | 15 | 12 | 12 | 4 | 12 | 12 | 4 | 2,2% |
| Feature Phone | 8517.14.31 | 0 | 11,25 | 11,25 | 12 | 0 | 4 | 12 | 12 | 4 | 0 |
| Smart Camera | 8525.89.29 | 0 | 15 | 15 | 12 | 12 | 0 | 12 | 12 | 7 | 2,2% |
| Monitor PPB | 8528.52.00 | 0 | 0 | 0 | 12 | 12 | 0 | 12 | 12 | 7 | 0 |
| Smartwatch | 9102.12.20 | 0 | 15 | 15 | 0 | 0 | 0 | 12 | 12 | 12 | 0 |

> Tabela completa com 40+ produtos no código (`PRODUTOS[]`).

---

## 8. Validações

### 8.1 Campos obrigatórios para calcular

O `useMemo` do bloco de cálculo não tem guard explícito — o cálculo sempre roda. Mas os resultados são meaningless sem:

- `prodId` selecionado (produto do catálogo)
- `origem` e `modalidade` selecionados (têm default)
- `ufDestino` selecionado (tem default SP)

### 8.2 Proteções aritméticas

```js
// Prevenção de divisão por zero no denominador
pSI = soma < 1 ? cmvTotal / (1 - soma) : cmvTotal × 99

// Formatação: valores infinitos ou NaN → string vazia
brl(v) = (!isFinite(v) || isNaN(v)) ? "" : v.toLocaleString(...)

// DIFAL: nunca negativo
difal = (delta > 0) ? delta : 0

// icmsEfPct: nunca negativo
icmsEfPct = max(0, aliqInter - cred)

// pcSubvPct: nunca negativo
pcSubvPct = max(0, resultado_formula)

// stV: nunca negativo
stV = max(0, stBase × (icmsDestST/100) - icmsV)
```

### 8.3 CBU — II automático

Ao selecionar `modalidade = "CBU"`, o sistema busca a alíquota de II no `TEC_II` pelo NCM do produto:
- Encontrado: preenche `aliqII` automaticamente + status `"ok"`
- Não encontrado: mantém valor anterior + status `"err"` (aviso ao usuário)

### 8.4 Reset de campos ao trocar origem

```
MAO → outra origem:  cra = 0    (CRA é exclusivo MAO)
IOS → outra origem:  cfImp = 0  (Crédito Federal é exclusivo IOS)
```

### 8.5 Frete calculado (CALC_DEF)

O campo frete pode ser calculado via assistente com parâmetros:
```
CALC_DEF.frete = { sUSD, aUSD, saUSD, pS, pA, pSA, applied }
```
> `pS` = porcentagem superficial (default 100%), `pA` = porcentagem aérea, `pSA` = misto.

### 8.6 Custo Financeiro de Venda calculado

```
CALC_DEF.cfVenda = { prazo: 60, taxa: 1.14, applied }
```
> Prazo padrão 60 dias, taxa 1,14% ao mês.

---

## Apêndice — Fluxo resumido da formação de preço

```
1. cmvTotal = VPL + producao + garantia + bkpV + embalagem + outros
              └── VPL = CFR × ptax + II + despesas + cfImp + PPB + CRA

2. Resolve atributos por produto × origem × modalidade:
   → ipi, cred, icms, fti (via getProdAtributos)

3. Calcula percentuais tributários:
   → pcPct (regime P/C)
   → aliqInter (matriz MX)
   → icmsEfPct = max(0, aliqInter - cred)
   → difal (se não-contrib ou imobilizado)
   → pcEf, pcSubvPct
   → ipiCreditoIOSPct (IOS apenas)
   → indPct (soma de todos os índices de venda)

4. Monta denominador:
   soma = ipiF × (pcEf + pcSubvPct + icmsEfPct + difal
                + ftiPct + fcpPct + indPct + margGerPct + margem
                - ipiCreditoIOSPct) / 100

5. Calcula preços:
   pSI = cmvTotal / (1 - soma)
   pCI = pSI × (1 + ipi/100)
   pF  = pCI + stV

6. Calcula valores monetários sobre pF:
   pcV, ipiV, icmsEfV, difalV, ftiV, fcpV, stV, margGerV, margV...

7. MC = (margV + cfxV + [margGerV se toggle ON]) / pF
```
