// api/ii.js — Vercel Function (ES Module)
// Consulta o II do simulador da Receita Federal
// Uso: /api/ii?ncm=8517.13.00

import https from "https";

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Positec/1.0)",
        "Referer": "https://www4.receita.fazenda.gov.br/simulador/",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("latin1");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ncm } = req.query;
  if (!ncm) return res.status(400).json({ error: "NCM obrigatorio" });

  const ncmLimpo = ncm.replace(/\./g, "");

  try {
    // GET no simulador com NCM e valor fictício
    const url = `https://www4.receita.fazenda.gov.br/simulador/BuscaNCM.jsp?NCM=${ncmLimpo}&ValorAduaneiro=1000&Moeda=BRL`;
    const result = await httpsGet(url);
    const html = result.body;

    // Padrão 1: célula com "II" seguida do percentual
    const p1 = html.match(/II\s*<\/[^>]+>\s*<[^>]+>\s*([\d]+[,\.][\d]+)\s*%/i);
    if (p1) return res.status(200).json({ ii: parseFloat(p1[1].replace(",", ".")), ncm });

    // Padrão 2: "II" e número% em qualquer posição
    const p2 = html.match(/\bII\b[^\d<]{0,30}([\d]+[,\.][\d]+)\s*%/);
    if (p2) return res.status(200).json({ ii: parseFloat(p2[1].replace(",", ".")), ncm });

    // Retorna debug para diagnóstico
    return res.status(200).json({ ii: null, ncm, status: result.status, debug: html.substring(0, 1500) });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
