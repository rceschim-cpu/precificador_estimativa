// Proxy server-side para o IBM Planning Analytics (Cognos/PA).
//
// Roda como função serverless (Vercel) — NUNCA mover essa chamada pro
// frontend. Credenciais do PA são muito mais sensíveis que uma API key de
// LLM (dão acesso a dados de custo/preço corporativos), então não seguem o
// padrão VITE_* usado pelo chat (que expõe a chave no bundle do navegador).
// As env vars aqui (PA_BASE_URL, PA_API_TOKEN) só existem no runtime do
// servidor Vercel — nunca no bundle do Vite.
//
// PENDENTE (ver docs/cognos-integracao/CHAMADO_GLPI.md e RESULTADOS.md):
// - Mecanismo real de autenticação de backend ainda não confirmado pela TI.
//   Assume Bearer token por enquanto — ajustar getAuthHeaders() quando a TI
//   responder (pode virar Basic/CAM, API key trocada por IAM token, etc).
// - Não confirmamos se o cubo PCF.230.Premissa_Impostos tem uma view
//   publicada chamada "Default" (outro cubo, PCF.011, retornou 404 nela).
//   Se der 404 aqui, é isso — vai precisar pedir a view nomeada no chamado.
// - Formato exato do cellset retornado por tm1.Execute não foi validado
//   contra este ambiente — por isso devolvemos o JSON cru por enquanto
//   (ver `raw` na resposta) em vez de arriscar um parser errado.

const PA_SERVER = "POS_COST_PRICING";
const PA_CUBE = "PCF.230.Premissa_Impostos";
const PA_VIEW = "Default";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — cache em memória do processo
const cache = new Map(); // sobrevive só enquanto a function ficar "quente"

function getAuthHeaders() {
  // TODO: trocar quando a TI confirmar o mecanismo real (ver PENDENTE acima)
  return { Authorization: `Bearer ${process.env.PA_API_TOKEN}` };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { ncm, uf } = req.query || {};
  if (!ncm || !uf) {
    return res.status(400).json({ error: "Parâmetros obrigatórios: ncm, uf" });
  }

  const baseUrl = process.env.PA_BASE_URL;
  const token = process.env.PA_API_TOKEN;
  if (!baseUrl || !token) {
    return res.status(503).json({
      error:
        "Integração Cognos/PA ainda não configurada nesta instância " +
        "(faltam PA_BASE_URL/PA_API_TOKEN) — aguardando credenciais da TI, " +
        "ver docs/cognos-integracao/CHAMADO_GLPI.md",
    });
  }

  const cacheKey = `${ncm}|${uf}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  const url =
    `${baseUrl}/prism/harmony/tm1serverexplorer/api/v1/Servers('${PA_SERVER}')` +
    `/Cubes('${PA_CUBE}')/Views('${PA_VIEW}')/tm1.Execute` +
    `?$expand=Cells($select=Value),Axes($expand=Tuples($expand=Members($select=Name)))`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({
        error: `PA respondeu ${r.status} — ver PENDENTE em api/cognos-indices.js`,
        detail,
      });
    }

    const raw = await r.json();
    const data = { raw, ncm, uf, note: "Resposta crua do PA — parser estruturado pendente de validação (ver TODOs no arquivo)" };

    cache.set(cacheKey, { data, at: Date.now() });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Falha ao consultar Cognos/PA", detail: String(e) });
  }
}
