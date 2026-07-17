# Ingestão mensal — Integrado Precificado.xlsx → Supabase

Gera SQL de INSERT pra `precificacao_indices` e `precificacao_custos` a partir do
arquivo mensal `MM.YYYY - Integrado Precificado.xlsx` (pasta "Precificado mensal").

O anon key do app **não tem permissão de INSERT** nessas tabelas (de propósito,
por segurança) — os scripts só geram o `.sql`, quem roda no Supabase SQL Editor
é o dono do banco.

## Uso

**`precificacao_indices` tem unique constraint em `(sku,canal,cliente,planta)`
— sem o mês/data. Só existe 1 linha por combinação, sempre a mais recente.**
Um INSERT puro falha com `duplicate key` assim que a combinação já existe
(cliente que repete compra em outro mês). Use `build_indices_upsert.py`
(gera `insert ... on conflict (...) do update`) — nunca o CSV Import do
Table Editor pra essa tabela, ele não faz upsert e para no primeiro conflito
(comprovado: uma tentativa via CSV parou depois de ~1000 linhas de 37 mil).

```
python build_indices_upsert.py "<pasta com os xlsx>" saida_prefixo "04:Abr/2026" "05:Mai/2026" ...
# gera saida_prefixo_part01deNN.sql ... rodar cada um no SQL Editor, em qualquer ordem

python build_custos.py  "<caminho do xlsx>" "Mmm/AAAA" "AAAA-MM-01" <taxas_ref.json> saida_custos
# gera saida_custos_part01deNN.sql — essa tabela não teve conflito nos testes (agregado por mês,
# então SKU×Planta×mês novo não colide with meses anteriores); INSERT puro ou CSV Import funcionam.

python export_csv.py "<pasta com os xlsx>" <taxas_ref.json> <pasta_saida> "04:Abr/2026:2026-04-01" ...
# gera 1 CSV por tabela (todos os meses juntos) — só use pra precificacao_custos (indices precisa
# do upsert acima, CSV Import não serve pra ela)
```

`build_indices.py`/`build_custos.py` (INSERT puro, sem upsert) ainda existem
mas só servem pra `precificacao_custos` ou pra uma tabela vazia/sem overlap.

`taxas_ref.json` é um dump de `precificacao_custos` (sku, planta, icms_pct, ipi_pct,
cred_presum_pct, fti_pct, data_ref) — usado como referência de tributos, já que eles
não vêm do arquivo bruto (ver "Regras" abaixo). Buscar com paginação (limit 1000 é o
teto do PostgREST):

```
GET /rest/v1/precificacao_custos?select=sku,planta,icms_pct,ipi_pct,cred_presum_pct,fti_pct,data_ref&order=data_ref.desc&limit=1000&offset=<N>
```

## Regras confirmadas (validadas cruzando com dados reais já no banco)

- Filtrar SEMPRE `Valor Ou Ajuste = "Valor"` e `Venda ou Devolução = "Venda"`
  (exclui linhas de ajuste contábil e devoluções). Validado exato: volume e
  `cmv_unit`.
- `precificacao_indices` é por TRANSAÇÃO (pega a mais recente do mês por
  SKU×cliente×canal) — os campos `_pct` são o valor absoluto da coluna
  "Montante_" de cada condição SAP (ex: `ZV11 - CustoFixo-Precif(%) - Montante_`),
  NÃO a "Valor_" (essa é R$). `mc_pct`/`ml_pct` vêm direto de "MC - %"/"ML - %",
  como fração (não multiplicar por 100).
- `precificacao_custos` é AGREGADO por SKU×Planta×mês.
- **ICMS/IPI/crédito presumido/FTI não vêm do arquivo bruto** — são fixos por
  SKU×Planta em todos os meses testados (ex: sempre 12%/9,75%/12%/0% pra um SKU
  em "Ilhéus", mesmo com notas de destinos diferentes tendo alíquotas de ICMS
  bem diferentes: 7%/12%/19,5%). Vêm de uma referência tributária (Cadastro),
  não da nota fiscal. Os scripts usam o último valor já existente no banco pra
  esse SKU×Planta como fallback — SKUs sem histórico ficam com 0 (~15-25% dos
  casos observados; provavelmente produtos novos sem histórico).

## Metodologia aproximada (sem gabarito pra validar 100%)

- `receita_liq` = soma de `ZT03 - Total Preço - Valor_` das linhas Venda —
  Rafael confirmou que não há como comparar contra o valor legado (não se sabe
  como foi calculado da vez passada). Escolhido por ser direto e auditável.
- `preco_medio` = receita_liq / volume — não é usado pelo motor de cálculo da
  calculadora (preço é sempre informado pelo usuário ou vem da margem), então
  não precisa bater com precisão.
- `garantia_pct`, `backup_pct`, `difal_pct`, `st_pct` = |soma da coluna R$|
  ÷ receita_liq × 100 (média ponderada). Garantia varia por quantos anos de
  garantia foram vendidos em cada nota — por isso não é um valor fixo mês a
  mês, é uma média real da mistura de vendas daquele mês.
- `mc_pct`/`ml_pct` = soma("MC - R$"/"ML - R$") ÷ receita_liq.
- `custo_usd_unit`, `custo_transf_unit`, `ggf_unit`, `cmv_unit` = soma da
  coluna "Valor_"/resumo ÷ volume (média ponderada por volume). `cmv_unit`
  validado exato contra um registro real já no banco.
