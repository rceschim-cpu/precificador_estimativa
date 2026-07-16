# Ingestão mensal — Integrado Precificado.xlsx → Supabase

Gera SQL de INSERT pra `precificacao_indices` e `precificacao_custos` a partir do
arquivo mensal `MM.YYYY - Integrado Precificado.xlsx` (pasta "Precificado mensal").

O anon key do app **não tem permissão de INSERT** nessas tabelas (de propósito,
por segurança) — os scripts só geram o `.sql`, quem roda no Supabase SQL Editor
é o dono do banco.

## Uso

```
python build_indices.py "<caminho do xlsx>" "Mmm/AAAA" saida_indices.sql
python build_custos.py  "<caminho do xlsx>" "Mmm/AAAA" "AAAA-MM-01" <taxas_ref.json> saida_custos.sql
```

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
