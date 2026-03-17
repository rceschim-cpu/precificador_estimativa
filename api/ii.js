// api/ii.js — Vercel Function
// Consulta o II (Imposto de Importação) do simulador da Receita Federal
// pelo NCM informado como query param: /api/ii?ncm=8517.13.00

export default async function handler(req, res) {
  // CORS para o domínio do app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { ncm } = req.query;
  if (!ncm) return res.status(400).json({ error: "NCM obrigatório" });

  // Remove pontos para o simulador (ex: 8517.13.00 → 85171300)
  const ncmLimpo = ncm.replace(/\./g, "");

  try {
    // POST para o simulador da Receita com valor fictício (R$ 1000)
    const form = new URLSearchParams({
      acao:          "simularTratamentoAdministrativo",
      txtNCM:        ncmLimpo,
      txtValorAd:    "1000",
      txtMoeda:      "BRL",
    });

    const resp = await fetch("https://www4.receita.fazenda.gov.br/simulador/Resultado.jsp", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "User-Agent":    "Mozilla/5.0 (compatible; PositecPrecificador/1.0)",
        "Referer":       "https://www4.receita.fazenda.gov.br/simulador/",
        "Origin":        "https://www4.receita.fazenda.gov.br",
      },
      body: form.toString(),
    });

    if (!resp.ok) throw new Error(`Receita retornou ${resp.status}`);

    const html = await resp.text();

    // Extrai alíquota do II da tabela de resultado
    // O HTML contém algo como: <td>II</td><td>X,XX %</td>
    const match = html.match(/II[^<]*<\/td>\s*<td[^>]*>\s*([\d,\.]+)\s*%/i);
    if (!match) {
      // Segunda tentativa com padrão alternativo
      const match2 = html.match(/Imposto de Importa[^<]*<\/[^>]+>\s*<[^>]+>\s*([\d,\.]+)\s*%/i);
      if (!match2) {
        return res.status(200).json({ ii: null, fonte: "receita", erro: "Alíquota não encontrada na resposta" });
      }
      const ii2 = parseFloat(match2[1].replace(",", "."));
      return res.status(200).json({ ii: ii2, ncm, fonte: "receita" });
    }

    const ii = parseFloat(match[1].replace(",", "."));
    return res.status(200).json({ ii, ncm, fonte: "receita" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
