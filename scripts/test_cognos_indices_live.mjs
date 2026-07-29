// Teste MANUAL com credencial real e temporária (token extraído do DevTools
// de uma sessão já logada no PA). NÃO usa fetch mockado — chama o PA de
// verdade. Só pra validar a query e o formato de resposta antes do GLPI
// responder — não é um teste automatizado nem roda em CI.
//
// Uso (PowerShell):
//   $env:PA_BASE_URL = "https://positivo.planning-analytics.cloud.ibm.com"
//   $env:PA_API_TOKEN = "<token colado do header Authorization>"
//   node scripts/test_cognos_indices_live.mjs [ncm] [uf]
//
// Uso (bash):
//   PA_BASE_URL="https://positivo.planning-analytics.cloud.ibm.com" \
//   PA_API_TOKEN="<token>" node scripts/test_cognos_indices_live.mjs [ncm] [uf]
//
// Depois de rodar: apagar o token do terminal/histórico (Ctrl+C não some
// com env var já setada na sessão — feche o terminal ou rode
// `Remove-Item Env:PA_API_TOKEN` / `unset PA_API_TOKEN`).

import handler from "../api/cognos-indices.js";

const ncm = process.argv[2] || "8471.30.19"; // Notebook 15"+, só de exemplo
const uf = process.argv[3] || "SP";

if (!process.env.PA_BASE_URL || !process.env.PA_API_TOKEN) {
  console.error("Faltam PA_BASE_URL e/ou PA_API_TOKEN nas variáveis de ambiente.");
  console.error("Ver instruções no topo deste arquivo.");
  process.exit(1);
}

const res = {
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(obj) { this.body = obj; return this; },
  setHeader() {},
};

await handler({ method: "GET", query: { ncm, uf } }, res);

console.log(`\nStatus: ${res.statusCode}`);
console.log(JSON.stringify(res.body, null, 2));

if (res.statusCode === 200) {
  console.log("\n✅ Chamada funcionou. Cole o JSON acima de volta na conversa pra eu escrever o parser real.");
} else if (res.statusCode === 502) {
  console.log("\n⚠️ PA respondeu com erro — pode ser token expirado (eles duram pouco), view 'Default' não existe nesse cubo, ou auth incorreta. Ver `detail` acima.");
} else {
  console.log("\n⚠️ Resposta inesperada — ver detalhes acima.");
}
