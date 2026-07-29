// Cliente do proxy serverless pro IBM Planning Analytics (Cognos/PA).
// Ver api/cognos-indices.js e docs/cognos-integracao/ pro contexto completo.
//
// Ainda NÃO usado no cálculo tributário (src/App.jsx) — é capacidade de
// leitura isolada, pronta pra validação manual enquanto o chamado GLPI não
// resolve autenticação de backend + view do cubo de índices. Ligar isso ao
// cálculo de preço é uma decisão de fórmula tributária e precisa de
// confirmação explícita do Rafael (regra do CLAUDE.md).

export async function fetchIndicesCognos(ncm, uf) {
  const params = new URLSearchParams({ ncm, uf });
  const r = await fetch(`/api/cognos-indices?${params}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Falha ao consultar Cognos/PA (${r.status})`);
  return data;
}
