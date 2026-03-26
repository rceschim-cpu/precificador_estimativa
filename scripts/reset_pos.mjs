// Reset produtos POS: remove todos e insere os 11 modelos consolidados
const SB_URL = "https://eiihpyzihiqhhwirqwxe.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaWhweXppaGlxaGh3aXJxd3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODA4MTUsImV4cCI6MjA4OTM1NjgxNX0.7DBHSMAOBUcrEPbpWIq9z87SQlXyxFbV2i98a2boW_s";

const headers = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function req(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...(opts.headers||{}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// 11 modelos consolidados de terminais POS
// NCM 8470.50.10 — Terminal de Pagamento
// Impostos MAO: IPI=0, cred=12, ICMS=12 (padrão POS ZFM)
// Impostos IOS/CWB: zeros (não fabricado nestas plantas)
const NOVOS_POS = [
  { id:"POS0001", nome:"L400 Rede"   },
  { id:"POS0002", nome:"L300 Cielo"  },
  { id:"POS0003", nome:"L300 Stone"  },
  { id:"POS0004", nome:"L300 TON"    },
  { id:"POS0005", nome:"L400 Stone"  },
  { id:"POS0006", nome:"D300 Stone"  },
  { id:"POS0007", nome:"D400 Stone"  },
  { id:"POS0008", nome:"S350 Rede"   },
  { id:"POS0009", nome:"S300 Stone"  },
  { id:"POS0010", nome:"L300 Av1.5"  },
  { id:"POS0011", nome:"L400 Av1.5"  },
];

const rows = NOVOS_POS.map(p => ({
  id: p.id, sku: "", nome: p.nome, ncm: "8470.50.10",
  ipi_mao: 0, ipi_ios: 0, ipi_cwb: 0,
  cred_mao: 12, cred_ios: 0, cred_cwb: 0,
  icms_mao: 12, icms_ios: 12, icms_cwb: 4,
  mva: 0, fti: 2.2, aliq_st: 0,
  vpl_padrao: 0, producao: 0, garantia: 0, bkp_pct: 0, embalagem: 0,
  pd: 0, scrap: 0, royal: 0, frete_venda: 0, marg_ger: 0, mkt: 0, rebate: 0,
}));

// 1. Deletar todos os POS existentes
console.log("Deletando produtos POS existentes...");
await req("produtos_catalogo?id=like.POS*", {
  method: "DELETE",
  headers: { "Prefer": "return=minimal" },
});
console.log("  ✓ Deletados.");

// 2. Inserir os 11 novos
console.log("Inserindo 11 modelos consolidados...");
const inserted = await req("produtos_catalogo", {
  method: "POST",
  body: JSON.stringify(rows),
});
console.log(`  ✓ ${inserted?.length ?? 11} produtos inseridos:`);
(inserted || rows).forEach(p => console.log(`    ${p.id} — ${p.nome}`));
console.log("\nConcluído.");
