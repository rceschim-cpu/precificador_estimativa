// api/ii.js — Vercel Function (ES Module)
import https from "https";

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
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
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ncm } = req.query;
  if (!ncm) return res.status(400).json({ error: "NCM obrigatorio" });

  const ncmLimpo = ncm.replace(/\./g, "");
  const body = `acao=simularTratamentoAdministrativo&txtNCM=${ncmLimpo}&txtValorAd=1000&txtMoeda=BRL`;

  try {
    const result = await httpsPost(
      "https://www4.receita.fazenda.gov.br/simulador/Resultado.jsp",
      body
    );

    const html = result.body;

    // Padrao 1: <td>II</td><td>X,XX %</td>
    const p1 = html.match(/>\s*II\s*<\/td>\s*<td[^>]*>\s*([\d]+[,\.][\d]+)\s*%/i);
    if (p1) return res.status(200).json({ ii: parseFloat(p1[1].replace(",", ".")), ncm });

    // Padrao 2: qualquer II seguido de numero%
    const p2 = html.match(/II[^\d<]{0,20}([\d]+[,\.][\d]+)\s*%/i);
    if (p2) return res.status(200).json({ ii: parseFloat(p2[1].replace(",", ".")), ncm });

    // Debug — retorna trecho do HTML
    return res.status(200).json({ ii: null, ncm, debug: html.substring(0, 1000) });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
