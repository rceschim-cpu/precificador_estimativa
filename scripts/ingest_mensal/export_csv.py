# -*- coding: utf-8 -*-
# Gera 1 CSV por tabela (todos os meses juntos) para upload via
# Supabase Table Editor -> Insert -> "Import data from CSV".
# Uso: python export_csv.py <pasta_com_xlsx> <taxas_ref.json> <pasta_saida> MM:Label:AAAA-MM-01 [MM:Label:AAAA-MM-01 ...]
import sys, csv, json
from build_indices import build_indices
from build_custos import build_custos

def write_csv(path, cols, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"{path}: {len(rows)} linhas")

if __name__ == "__main__":
    pasta, taxas_json, saida = sys.argv[1:4]
    meses = sys.argv[4:]  # "04:Abr/2026:2026-04-01"

    taxas_raw = json.load(open(taxas_json, encoding="utf-8"))
    taxas_ref = {}
    for r in taxas_raw:
        key = (str(r['sku']), r['planta'])
        if key not in taxas_ref:
            taxas_ref[key] = (r['icms_pct'] or 0, r['ipi_pct'] or 0, r['cred_presum_pct'] or 0, r['fti_pct'] or 0)

    todas_indices = []
    todas_custos = []
    for mes in meses:
        num, label, data_ref = mes.split(":")
        xlsx = f"{pasta}/{num}.2026 - Integrado Precificado.xlsx"
        todas_indices.extend(build_indices(xlsx, label))
        rows, skipped = build_custos(xlsx, label, data_ref, taxas_ref)
        print(f"{label}: {len(rows)} custos, {len(skipped)} sem referencia de imposto")
        todas_custos.extend(rows)

    cols_idx = ["sku","canal","cliente","cliente_nome","planta","data_ref","ipi_pct","icms_pct","cred_pct","fti_pct",
                "pd_pct","scrap_pct","frete_pct","zv09_pct","zv11_pct","mkt_pct","bkp_pct","rebate_pct",
                "margger_pct","margem_pct","mc_pct","ml_pct","fonte"]
    cols_custos = ["sku","planta","ncm","data_ref","volume","receita_liq","preco_medio","custo_usd_unit","taxa_dolar",
                   "custo_brl_unit","custo_transf_unit","ggf_unit","cmv_unit","garantia_pct","backup_pct","st_pct",
                   "difal_pct","icms_pct","ipi_pct","cred_presum_pct","fti_pct","mc_pct","ml_pct","fonte"]

    write_csv(f"{saida}/precificacao_indices_import.csv", cols_idx, todas_indices)
    write_csv(f"{saida}/precificacao_custos_import.csv", cols_custos, todas_custos)
