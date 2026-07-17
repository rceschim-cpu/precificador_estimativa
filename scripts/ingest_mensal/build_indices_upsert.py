# -*- coding: utf-8 -*-
# Gera SQL de upsert (insert ... on conflict do update) pra precificacao_indices,
# já que a tabela tem unique constraint em (sku,canal,cliente,planta) sem o mes/data —
# so pode existir 1 linha por combinacao, sempre a mais recente.
import sys, json
sys.path.insert(0, ".")
from build_indices import build_indices, sq

COLS = ["sku","canal","cliente","cliente_nome","planta","data_ref","ipi_pct","icms_pct","cred_pct","fti_pct",
        "pd_pct","scrap_pct","frete_pct","zv09_pct","zv11_pct","mkt_pct","bkp_pct","rebate_pct",
        "margger_pct","margem_pct","mc_pct","ml_pct","fonte"]
CONFLICT_KEYS = ["sku","canal","cliente","planta"]
UPDATE_COLS = [c for c in COLS if c not in CONFLICT_KEYS]

if __name__ == "__main__":
    pasta, out = sys.argv[1], sys.argv[2]
    meses = sys.argv[3:]  # "04:Abr/2026"
    todas = []
    for mes in meses:
        num, label = mes.split(":")
        xlsx = f"{pasta}/{num}.2026 - Integrado Precificado.xlsx"
        rows = build_indices(xlsx, label)
        print(f"{label}: {len(rows)} linhas")
        todas.extend(rows)

    # dedup: se a mesma combinacao (sku,canal,cliente,planta) aparecer em mais de 1 dos meses
    # importados agora, fica so a de data_ref mais recente (senao o upsert dentro do MESMO
    # arquivo bate consigo mesmo — "ON CONFLICT DO UPDATE command cannot affect row a second time")
    by_key = {}
    for r in todas:
        k = tuple(r[c] for c in CONFLICT_KEYS)
        if k not in by_key or r["data_ref"] > by_key[k]["data_ref"]:
            by_key[k] = r
    rows = list(by_key.values())
    print(f"Total apos dedup por (sku,canal,cliente,planta): {len(rows)} (de {len(todas)})")

    BATCH = 1000
    n_parts = (len(rows) + BATCH - 1) // BATCH
    set_clause = ",\n  ".join(f"{c}=excluded.{c}" for c in UPDATE_COLS)
    for part, i in enumerate(range(0, len(rows), BATCH), start=1):
        chunk = rows[i:i+BATCH]
        fname = f"{out}_part{part:02d}de{n_parts:02d}.sql"
        with open(fname, "w", encoding="utf-8") as f:
            f.write(f"insert into precificacao_indices ({','.join(COLS)}) values\n")
            vals = ["(" + ",".join(sq(row[c]) for c in COLS) + ")" for row in chunk]
            f.write(",\n".join(vals))
            f.write(f"\non conflict ({','.join(CONFLICT_KEYS)}) do update set\n  {set_clause};\n")
    print(f"-> {n_parts} arquivos gerados ({out}_part01de{n_parts:02d}.sql ...)")
