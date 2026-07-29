# Integração de leitura Precificador ↔ Cognos/PA — implementação

> Lado de LEITURA (índices tributários). Lado de escrita (formalização de
> precificação) espera o chamado GLPI — ver `CHAMADO_GLPI.md`.

## Arquitetura

```
Frontend (src/App.jsx, futuro)
   │  fetchIndicesCognos(ncm, uf)   [src/cognosClient.js]
   ▼
/api/cognos-indices.js  (função serverless Vercel)
   │  Bearer token (env var server-only, NUNCA VITE_*)
   ▼
IBM Planning Analytics — TM1 REST API v1
   /prism/harmony/tm1serverexplorer/api/v1/Servers('POS_COST_PRICING')
     /Cubes('PCF.230.Premissa_Impostos')/Views('Default')/tm1.Execute
```

**Por que um proxy serverless e não chamada direta do frontend** (como o
chat LLM faz com `VITE_CLAUDE_KEY`): credenciais do PA dão acesso a dados de
custo/preço corporativos — expor isso no bundle do navegador é um risco bem
maior que uma API key de LLM. O proxy mantém a credencial só no servidor.

## Variáveis de ambiente (Vercel — Settings → Environment Variables)

| Variável | Conteúdo | Status |
|---|---|---|
| `PA_BASE_URL` | URL base do tenant PA (ex. `https://positivo.planning-analytics.cloud.ibm.com`) | a definir após retorno do GLPI |
| `PA_API_TOKEN` | Token de autenticação backend contra o TM1 REST API v1 | **pendente** — mecanismo exato ainda não confirmado pela TI |

**NÃO usar prefixo `VITE_`** nessas duas — isso as exporia no bundle do
navegador. Elas só devem existir no runtime da função serverless.

## O que já está pronto
- `api/cognos-indices.js`: recebe `?ncm=...&uf=...`, monta a chamada ao TM1
  REST API v1 (padrão confirmado no mapeamento — ver
  `docs/cognos-integracao/RESULTADOS.md`), cacheia por 15 min em memória do
  processo, devolve erro claro se as env vars não estiverem configuradas.
- `src/cognosClient.js`: helper de frontend (`fetchIndicesCognos(ncm, uf)`)
  pra chamar o proxy — ainda não conectado a nenhuma tela.

## O que falta validar antes de ir pra produção
1. **Credenciais reais** (`PA_BASE_URL`, `PA_API_TOKEN`) — dependem do
   chamado GLPI (pedido #3 do `CHAMADO_GLPI.md`).
2. **View do cubo**: assumimos que `PCF.230.Premissa_Impostos` tem uma view
   `Default` publicada — não testamos isso especificamente (só sabemos que
   OUTRO cubo, `PCF.011.Aberturas_PO`, NÃO tinha). Se der 404, é isso —
   confirmar/pedir a view certa.
3. **Formato do cellset**: a query usa o padrão documentado pela IBM pra
   `tm1.Execute` com `$expand` de Cells/Axes/Tuples/Members, mas não foi
   testada contra este ambiente real — por isso a função devolve o JSON cru
   (`raw`) em vez de um parser estruturado. Depois de ver uma resposta real,
   escrever o parser que mapeia `raw` pro formato que o Precificador
   consome (NCM/UF/Centro/Versão/Período → % ICMS/IPI/PIS-COFINS/DIFAL/IBS).
4. **Wiring no cálculo**: mesmo com tudo validado, plugar esses dados na
   fórmula tributária (`src/App.jsx`/`src/planTrib.js`) exige confirmação
   explícita do Rafael — não é automático só porque a API funciona.

## Como testar manualmente assim que houver credenciais
1. Configurar `PA_BASE_URL` e `PA_API_TOKEN` no Vercel (ambiente de preview
   primeiro, não produção).
2. Deploy de preview, depois acessar
   `https://<preview-url>/api/cognos-indices?ncm=8471.30.19&uf=SP` no
   navegador ou via `curl`.
3. Conferir o `raw` retornado — se vier um cellset válido, atualizar este
   documento com o formato real e escrever o parser estruturado.
4. Se vier 404 na view, seguir o pedido #2 do `CHAMADO_GLPI.md` (view
   nomeada e publicada).
