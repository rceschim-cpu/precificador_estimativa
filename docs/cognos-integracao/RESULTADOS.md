# Resultados do mapeamento — IBM Planning Analytics (Cognos/PA)

> Log cumulativo. Cada rodada de exploração do agente Cowork vira uma seção
> nova aqui (mais recente no topo). Preenchido pelo Claude desta conversa a
> partir do que o agente Cowork reportar — não editado diretamente pelo
> agente de mapeamento.

## Status atual

- [x] API REST confirmada — **TM1 REST API v1 (OData), padrão `/prism/harmony/tm1serverexplorer/api/v1/Servers('<db>')/Cubes('<cubo>')/Views('<view>')`** — capturada na rede real. Falta confirmar se aceita ESCRITA (POST/PATCH de células) e se esse path funciona sem sessão de usuário logado (ver item de autenticação abaixo).
- [ ] Mecanismo de autenticação p/ uso por backend identificado — ainda não; só vimos a sessão SSO do usuário logado
- [ ] Cubo/dimensão de índices tributários identificado — encontramos cubos de TABELA DE PREÇO (PCF.400, PCF.500), mas não onde ficam os índices tributários (ICMS/IPI/PIS-COFINS/MVA) em si — candidato mais provável: submenu "Premissas" (aparece em Geral, Cliente e PEP), ainda não explorado
- [x] Cubo/dimensão para formalização de precificações — **gap confirmado**: nenhuma das 3 tabelas (Geral, Cliente, PEP) é "1 clique = 1 registro individual" — todas são grades em lote/índice. Precisa decisão de arquitetura (ver observação abaixo)
- [~] Workspace `pa-plan-contribute` da URL inicial — entendemos a aplicação "Precificação" via menu, mas ainda não confirmamos se a URL EXATA original aponta pra essa mesma tela (Tabela Geral) ou outra
- [ ] Decisão: vale abrir chamado GLPI pedindo API/credencial de serviço? — **sim, provavelmente** (ver observação), mas aguardando fechar mais 1-2 rodadas antes de formalizar o pedido

---

## Rodada 1 — 2026-07-29 — Estrutura do app "Precificação" e fluxo de governança existente

**Confiança:** confirmado visualmente (screenshots + texto extraído da página).

### Hierarquia observada
- **Home → Menu Principal Pricing**, 6 blocos: Mapas, Simulador de Custos, **Tabela de Preço Geral**, **Tabela de Preço Cliente**, **Tabela de Preço PEP**, Pricing Governo, Segurança.
- **Tabela de Preço Geral** → submenu "Tabela Geral": Premissas, Lista Técnica, Lista Faturamento, Tabela de Preço Geral, Publica View, Subset.
- Entrando de novo → dashboard real `Tabela Geral.New`, com 6 abas: **Tabela Preço - Geral** (grid principal), **Repositório Propostas**, **Versionamento**, **Consulta Vers. e Gerar Arq. SAP**, **Arquivo Export**, **Rejeitados**.

### Fluxo de governança já existente (Tabela de Preço Geral)
Botões observados (nenhum clicado): `Carga Tabela Geral`, `Replicar Tabela`, `Enviar Proposta para Repositório`, ícone `Layout Arq.`, `Aplicar` (aba principal); `Retornar Proposta para Tabela` (aba Repositório Propostas).

Desenha um pipeline: **grid de trabalho → "Enviar Proposta para Repositório" (formaliza) → Versionamento → Consulta Vers. e Gerar Arq. SAP (exporta pro SAP) → Rejeitados (recusadas)**.

Conceitualmente é muito parecido com o que o Precificador precisa fazer ("botão subir precificação" = uma versão de "Enviar Proposta para Repositório"). **Mas** essa tela é de tabela EM LOTE (bulk), não de precificação individual por cliente — não necessariamente o lugar certo pra gravar UMA precificação do Precificador.

### Gap identificado
"Tabela de Preço Cliente" e "Tabela de Preço PEP" (menu principal) ainda não exploradas — soam mais alinhadas ao conceito "1 precificação = 1 registro", que é o que o botão do Precificador precisa. **Confirmar essas duas antes de decidir onde plugar a gravação.**

### Bloqueios
Nenhum. Regra de somente-leitura respeitada — não clicou em nenhum botão de ação (Aplicar, Enviar Proposta, Carga Tabela Geral, Replicar Tabela, Retornar Proposta).

---

## Rodada 2 — 2026-07-29 — Tabela de Preço Cliente, Tabela de Preço PEP e API real capturada

**Confiança:** estrutura e rede confirmadas visualmente (screenshots + rede real). Interpretação do significado de "PEP" é inferência, não confirmada com o time.

### Tabela de Preço Cliente
Mesmo padrão estrutural da Geral (submenu Premissas/Lista Técnica/Lista Faturamento/Tabela/Publica View/Subset + dashboard de 6 abas). **Cubo confirmado:** banco `POS_COST_PRICING`, cubo `PCF.400.Tabela_Preco_Clientes`. Filtros: período, segmento (T1+T2 PCs), tipo (Venda). Colunas: Código Garantia, Dolar Segmento, $ Software/Hardware BRL/USD, $ VPL Final, $ Custo Produção — **é tabela de índice por segmento/produto**, não registro individual de venda. Mesmo botão "Enviar Proposta para Repositório".

### Tabela de Preço PEP
Submenu diferente: Premissas, **Simulador Governo**, Lista Técnica, Lista Faturamento, Tabela de Preço PEP. Dashboard com só 4 abas (sem Repositório Propostas): Tabela Preço - PEP, **Versionamento e Export SAP** (botões `Gravar Versão Estática(SAP)` e `Gerar Arquivo Export SAP`), Consulta Versionamento, Rejeitados. **Cubo confirmado:** banco `POS_COST_PRICING`, cubo `PCF.500.Tabela_Preco_PEP`. Filtros: período, canal fixo "Governo", medida "Total PEP". Grid real visto: linhas por projeto/PEP (ex. "1910") × material (ex. "1000000008") × produto — granularidade mais fina (produto dentro de um projeto/pregão específico), mas ainda é **tabela em lote por projeto**, não "1 clique do usuário = 1 linha".

"PEP" aqui parece ligado a **vendas Governo** (licitação/pregão) — hipótese mais provável combinando com conhecimento geral: "PEP" é a sigla usual (BR) pra elemento de projeto/WBS do SAP, e essa tabela provavelmente rastreia precificação por elemento PEP de contratos/pregões de Governo. **Não confirmado com o time — só inferência.**

### 🔑 API REST real capturada (rede)
- `GET /prism/harmony/tm1serverexplorer/api/v1/Servers('POS_COST_PRICING')/Cubes('PCF.500.Tabela_Preco_PEP')/Views('Default')?$select=Name,Type` — **confirma a REST API pública do TM1** (OData v1), padrão `/api/v1/Servers('<db>')/Cubes('<cubo>')/Views('<view>')`. É a mesma família de API que a perspectiva `pa-plan-contribute` da URL original provavelmente usa por baixo dos panos pra gravar dados — bate com a hipótese inicial do briefing.
- `POST /prism/harmony/gridservice/api/v1/CreateHierarchyQuery` e `.../DestroyCellset` — endpoints internos da própria UI ("gridservice"/Harmony) que montam/destroem um cellset MDX pra renderizar o grid. **Não é API pública de integração** — é a UI conversando com o backend dela mesma. Ignorar para fins de integração externa.

### Observação de arquitetura (decisão do Rafael, não nossa)
Nenhuma das 3 tabelas mapeadas até agora (Geral, Cliente, PEP) representa "1 precificação do Precificador = 1 registro formal". Isso deixa duas opções em aberto:
1. **Criar um cubo/tabela novo** no PA especificamente para isso (precisa de alguém que administre o PA/TM1 — provavelmente via GLPI).
2. **Injetar linhas nas tabelas existentes** (ex. Cliente ou PEP), aproveitando o pipeline de governança que já existe — mas arriscado, porque essas tabelas alimentam processos em lote que já rodam pra SAP; um registro "avulso" no meio pode confundir quem usa essas telas hoje.
Essa decisão não deve ser tomada pelo agente de mapeamento nem por mim — precisa do time de Pricing/quem administra o PA.

### Bloqueios
Nenhum. Não clicou em `Aplicar`, `Carga Tabela Cliente/PEP`, `Enviar Proposta para Repositório`, `Gravar Versão Estática(SAP)`, `Gerar Arquivo Export SAP`. A extensão Claude in Chrome caiu uma vez no meio da sessão — reconectou e renavegou sem impacto nos achados.

### Em aberto pra próxima rodada
(a) significado exato de "PEP" — confirmar com Pricing/SAP; (b) se a API TM1 v1 aceita ESCRITA de células (não só leitura de Views) — crítico pro botão "subir precificação"; (c) explorar "Pricing Governo", "Mapas" e "Simulador de Custos" (menu principal, ainda não visitados); (d) revisitar a URL exata original (`pa-plan-contribute`) e comparar com o que foi encontrado via menu.
