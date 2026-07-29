// Teste manual de api/cognos-indices.js — sem credenciais reais do PA.
// Cobre: validação de parâmetros, erro claro quando faltam env vars, e
// (com env vars + fetch mockado) o caminho feliz + cache.
// Rodar: node scripts/test_cognos_indices.mjs
// Quando houver credenciais reais, apontar PA_BASE_URL/PA_API_TOKEN de
// verdade e usar `curl` contra o deploy, não este script (que mocka fetch).

import handler from "../api/cognos-indices.js";

let passed = 0, failed = 0;

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK   ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name} — ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
}

await check("método não-GET retorna 405", async () => {
  const res = mockRes();
  await handler({ method: "POST", query: {} }, res);
  assertEqual(res.statusCode, 405, "status");
});

await check("faltando ncm/uf retorna 400", async () => {
  const res = mockRes();
  await handler({ method: "GET", query: {} }, res);
  assertEqual(res.statusCode, 400, "status");
});

await check("sem PA_BASE_URL/PA_API_TOKEN retorna 503 com mensagem clara", async () => {
  delete process.env.PA_BASE_URL;
  delete process.env.PA_API_TOKEN;
  const res = mockRes();
  await handler({ method: "GET", query: { ncm: "8471.30.19", uf: "SP" } }, res);
  assertEqual(res.statusCode, 503, "status");
  if (!res.body.error.includes("GLPI")) throw new Error("mensagem de erro não referencia o chamado GLPI");
});

await check("com credenciais + fetch mockado, devolve raw e usa cache na 2ª chamada", async () => {
  process.env.PA_BASE_URL = "https://fake.example.com";
  process.env.PA_API_TOKEN = "fake-token";

  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls++;
    if (!url.includes("tm1.Execute")) throw new Error("URL não contém tm1.Execute: " + url);
    if (opts.headers.Authorization !== "Bearer fake-token") throw new Error("Authorization header incorreto");
    return {
      ok: true,
      json: async () => ({ value: [{ fakeCell: 42 }] }),
    };
  };

  try {
    const res1 = mockRes();
    await handler({ method: "GET", query: { ncm: "8471.30.19", uf: "SP" } }, res1);
    assertEqual(res1.statusCode, 200, "status 1ª chamada");
    if (!res1.body.raw) throw new Error("resposta não trouxe campo raw");
    assertEqual(fetchCalls, 1, "fetch deveria ter sido chamado 1x");

    const res2 = mockRes();
    await handler({ method: "GET", query: { ncm: "8471.30.19", uf: "SP" } }, res2);
    assertEqual(res2.statusCode, 200, "status 2ª chamada");
    assertEqual(res2.body.cached, true, "2ª chamada deveria vir do cache");
    assertEqual(fetchCalls, 1, "fetch NÃO deveria ser chamado de novo (cache)");
  } finally {
    global.fetch = originalFetch;
    delete process.env.PA_BASE_URL;
    delete process.env.PA_API_TOKEN;
  }
});

await check("PA respondendo erro (ex. 404 de view) propaga status 502 com detalhe", async () => {
  process.env.PA_BASE_URL = "https://fake.example.com";
  process.env.PA_API_TOKEN = "fake-token";
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404, text: async () => "view not found" });

  try {
    const res = mockRes();
    await handler({ method: "GET", query: { ncm: "9999.99.99", uf: "XX" } }, res);
    assertEqual(res.statusCode, 502, "status");
    if (!res.body.detail.includes("view not found")) throw new Error("detalhe do erro do PA não propagado");
  } finally {
    global.fetch = originalFetch;
    delete process.env.PA_BASE_URL;
    delete process.env.PA_API_TOKEN;
  }
});

console.log(`\n${passed} passou, ${failed} falhou`);
process.exit(failed > 0 ? 1 : 0);
