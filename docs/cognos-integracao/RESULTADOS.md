# Resultados do mapeamento — IBM Planning Analytics (Cognos/PA)

> Log cumulativo. Cada rodada de exploração do agente Cowork vira uma seção
> nova aqui (mais recente no topo). Preenchido pelo Claude desta conversa a
> partir do que o agente Cowork reportar — não editado diretamente pelo
> agente de mapeamento.

## Status atual

- [x] API REST confirmada — **TM1 REST API v1 (OData), padrão `/prism/harmony/tm1serverexplorer/api/v1/Servers('<db>')/Cubes('<cubo>')/Views('<view>')`** — capturada na rede real. Falta confirmar se aceita ESCRITA (POST/PATCH de células) e se esse path funciona sem sessão de usuário logado (ver item de autenticação abaixo).
- [ ] Mecanismo de autenticação p/ uso por backend identificado — ainda não; só vimos a sessão SSO do usuário logado
- [x] Cubo/dimensão de índices tributários identificado — **`PCF.230.Premissa_Impostos`** (banco `POS_COST_PRICING`), dimensionado por NCM×UF×Centro×Versão×Período×regime tributário, com % ICMS, ICMS Presumido, ISS, IPI, PIS/COFINS, DIFAL (3 variantes) e **IBS** (reforma tributária). Fonte exata dos índices que o Precificador precisa consumir.
- [x] Cubo/dimensão para formalização de precificações — **GAP CONFIRMADO, não existe tela pronta**: `PCF.011.Aberturas_PO` (Simulador de Custos) foi descartado — é sobre custo de IMPORTAÇÃO/aquisição (FOB, câmbio, LC, transit time), sem campos de cliente/canal/UF. Geral/Cliente/PEP são tabelas em lote. Nenhuma tela mapeada até agora serve pra "1 venda precificada = 1 registro". Provável necessidade de cubo novo — ver observação de arquitetura.
- [x] Workspace `pa-plan-contribute` da URL inicial — **resolvido**: é só a perspectiva-tipo do link, sempre abre o Home/Menu Principal — não é uma tela de contribuição específica
- [x] Decisão: vale abrir chamado GLPI pedindo API/credencial de serviço? — **SIM** — ver recomendação consolidada ao final do arquivo

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

---

## Rodada 3 — 2026-07-29 — Índices tributários confirmados (com IBS!) e candidato forte pra formalização (PO)

**Confiança:** confirmado visualmente (screenshots + nomes de cubo na UI). Captura de rede desta rodada foi inconclusiva (só pegou assets estáticos).

### 🎯 Índices tributários — FONTE CONFIRMADA
Aba "Premissas Por Impostos" (dentro do submenu Premissas, 10 sub-abas no total: Premissas Gerais por Centro, Premissa Dólar, Premissas Custos Serviços, Premissas Tempo de Produção, **Premissas Por Impostos**, Premissas Categoria por Produtos, Premissas por Área - Custo Fixo, Premissas Variáveis Comerciais - PEP, Premissas Custos Financeiros, Rejeitados).

**Cubo:** `PCF.230.Premissa_Impostos` (banco `POS_COST_PRICING`). Dimensionado por **NCM × UF × Centro × Versão × Período**, quebrado por **regime tributário** (Lucro Real, Lucro Presumido, Simples Nacional, Governo Estadual/Municipal/Federal, Outros). Colunas: % ICMS, % ICMS Presumido, % ISS, % IPI, % PIS/COFINS (2 variantes), % DIFAL (3 variantes), **% IBS** (o tributo novo da reforma tributária).

> ⚠️ Nota separada (fora do escopo desta integração, mas relevante pro Precificador): o PA já rastreia **IBS** por NCM/UF — a lógica tributária atual do Precificador (ICMS/PIS-COFINS/IPI clássicos) não tem esse tributo ainda. Vale um item de backlog à parte quando a reforma tributária começar a valer de fato.

### Pricing Governo → "Simulador Governo"
20 abas: Cadastro Produto, Premissas Gerais, Tabela Reposição, Curva VPL, Consulta Custos, Consulta Pricing, Custos, Exportação, Distribuição, Tempo Produção, Backup, Garantia e Instalação, Frete, NCM, Pricing, Impostos, Hedge, Exequibilidade, Margem Inversa, Versionamentos, Rejeitados. Ciclo completo de simulação (custo/imposto/frete/hedge/viabilidade) por produto/projeto governo. Botão `Transferir Produto` na aba Pricing (não clicado) — nome sugere ser o mecanismo que leva a simulação pra tabela oficial. É o MESMO objeto acessível como "Simulador Governo" no submenu da Tabela PEP — duas portas de entrada, um recurso só.

### ~~Simulador de Custos → "Simulação Pricing" — candidato~~ **DESCARTADO na Rodada 4**
Estruturado em torno do conceito de **"PO"** (aqui = Pedido/Proposta, não elemento SAP). Registro real visto: `PO D000011.01 - ME TL12`, status **PRECIFICADO**, período 202602. Botões: `Copiar PO` (cria nova a partir de molde "P.O. DUMMY"), `Aprovar PO` (formaliza). **Cubo:** `PCF.011.Aberturas_PO` (banco `POS_COST_PRICING`).

Parecia ser a estrutura mais próxima de "1 precificação = 1 registro formal" (identidade própria, status de workflow, botão de aprovação) — **mas a Rodada 4 corrigiu isso: "PO" aqui é Purchase Order de importação/compra de componentes, não venda a cliente.** Ver correção na Rodada 4 abaixo.

### URL original revisitada
Confirmado: `?perspective=pa-plan-contribute&id=...&dashboardId=...` sempre abre o **Home/Menu Principal Pricing** — é a raiz do app, não uma tela de contribuição específica. `pa-plan-contribute` é só o tipo de perspectiva do link salvo, não indica destino. Pergunta original das rodadas 1 fechada.

### Bloqueios
Nenhum clique em ação de gravação. Cliques apenas em abas/tiles de navegação + desligou o toggle "Editar" (que abriu ligado por padrão na tela de Premissas) antes de tocar em qualquer coisa — ação de segurança, não de gravação. Não clicou em: Atualizar Mapa, Atualizar Dimensões, Novo Produto, Atualizar Lista Técnica, Transferir Produto, Copiar PO, Aprovar PO.

### Em aberto pra próxima rodada
(a) Abrir uma PO existente e listar todos os campos/dimensões de um item (produto, cliente, canal, UF, preço, margem, quem precificou); (b) entender o que `Aprovar PO` muda de estado (workflow — quais status existem além de PRECIFICADO?); (c) desta vez chamar a leitura de rede ANTES de qualquer clique (ex. antes de abrir uma PO ou trocar de item) pra não perder as chamadas iniciais, já que a tentativa anterior só pegou assets estáticos.

---

## Rodada 4 — 2026-07-29 — Correção: PO é custo de importação, não venda. Gap de formalização confirmado.

**Confiança:** confirmado visualmente e via rede, exceto a hipótese sobre o que `Aprovar PO` altera (inferência, não testada).

### ❌ Correção da Rodada 3: "PO" é custo de importação, não venda a cliente
Ao detalhar `PO D000011.01 - ME TL12`: cabeçalho tem Período Base, Status, Quantidade, Peso, Organização de Venda (código SAP), Versão, **% Abertura LC** (carta de crédito de importação), Condição de Pgt., Transit Time, THC. Grade "Itens" (cubo `PCF.011.Aberturas_PO`): Alterar Origem?, Custo, Dólar, TX VP%, Quantidade, FOB, Moeda Contrato, Moeda, Por PO, Transit Time, Condição de Pgt., CF TOTAL, Juros. **Nenhum campo de cliente/canal/UF de destino** — é 100% custo de aquisição/importação (frete, câmbio, financiamento) que alimenta as Premissas, não a venda ao cliente final. Grade sem linhas populadas com os filtros testados.

### Status/Versão
O filtro "PRECIFICADO" é membro da dimensão `ALL.D.Versao` (não uma dimensão de status separada). Membros vistos: PRECIFICADO, PRECIFICADO 2, snapshots por data (20250501, 20250502, 20250504, 20250701, 2026.0401, 2026.0501...), REAL. Sem membros tipo APROVADO/REJEITADO — a coluna "Status" da grade (em branco pro registro visto) é provavelmente onde `Aprovar PO` grava, não a Versão. Não confirmado.

### ⚠️ Achado técnico relevante pra integração: nem todo cubo tem view pública "Default"
Chamando a API pública confirmada nas rodadas anteriores contra este cubo — `GET /prism/harmony/tm1serverexplorer/api/v1/Servers('POS_COST_PRICING')/Cubes('PCF.011.Aberturas_PO')/Views('Default')` — **retornou 404**. A grade é montada dinamicamente via MDX pelo `gridservice` interno (`CreateHierarchyQuery`, `DestroyCellset`, `Hierarchies`), não por uma view TM1 salva. **Implicação:** a API pública existe e funciona (200 confirmado em outros cubos), mas o cubo que o Precificador for consumir/gravar pode precisar de uma **view TM1 nomeada e publicada** especificamente pra isso — não dá pra assumir que "Default" sempre existe.

### "Nova PO" / criação de registro
Não há botão "+"/"Adicionar" separado. O único caminho visto é `Copiar PO` (a partir de molde "P.O. DUMMY") ou, tecnicamente, "Inserir membro" no menu de 3 pontos do filtro de PO (ação de escrita de metadado de dimensão — não testada).

### Bloqueios
Nenhum clique em ação de gravação. Toggle "Editar" apareceu ligado de novo (2ª vez, mesmo padrão de Premissas) — desta vez já veio desligado pela navegação normal; a árvore de acessibilidade indicou "on" mas o visual (fonte confiável) mostrava desligado. Editor de Conjunto aberto e cancelado sem aplicar/salvar.

---

## 📋 Recomendação consolidada (pós Rodadas 1-4)

### O que está resolvido
- **Índices tributários**: fonte confirmada — `PCF.230.Premissa_Impostos`, acessível via API pública TM1 (view a confirmar).
- **API de leitura**: existe, é REST/OData padrão IBM, funciona (200 confirmado em cubos com view `Default`).

### O que é um gap real (não resolvido pela exploração — é decisão de negócio/arquitetura)
**Não existe hoje, pronto, nenhuma tela/cubo em PA pra "1 venda precificada pelo Precificador = 1 registro formal".** Geral/Cliente/PEP são tabelas de índice em lote com pipeline próprio pro SAP; a PO do Simulador de Custos é sobre custo de importação. Isso não é uma limitação da API — é que a modelagem de dados do PA hoje não tem esse conceito.

### Recomendação: vale abrir o chamado GLPI — com 3 pedidos específicos
1. **Confirmar o gap**: perguntar ao time que administra o PA/Pricing se existe alguma tela que o mapeamento não encontrou pra "registro individual de precificação formalizada" (Mapas e Segurança, os 2 tiles do menu principal ainda não explorados, ficam como última checagem antes de assumir que não existe).
2. **Se confirmado o gap, pedir o desenho de um cubo novo** dedicado (ex. `PCF.xxx.Precificacoes_Formalizadas`), com as dimensões que o Precificador já tem: produto/NCM, cliente, canal, UF destino, data, preço final, margem, quem precificou — e que esse cubo tenha uma **view TM1 nomeada e publicada** (não depender de "Default").
3. **Pedir uma conta de serviço/API key** pra uso por backend (não sessão de usuário SSO) — ainda não sabemos como um sistema (sem humano logado) autenticaria contra a API TM1 v1.

### Antes de escrever o texto final do chamado
Sugiro 1 última rodada rápida (opcional) só pra fechar os 2 tiles não visitados (Mapas, Segurança) — caso um deles seja exatamente o que procuramos e evite o retrabalho de desenhar um cubo novo à toa.

---

## Rodada 5 (final) — 2026-07-29 — Mapas e Segurança descartados, mapeamento encerrado

**Confiança:** confirmado visualmente (screenshots + nomes de cubo na UI).

### Mapas → "Mapas Pricing"
6 abas: Mapa Produto Custos, Mapa Cliente, Mapa PEP, Mapa Código de Garantia, Mapa Área, Rejeitados. Cubo confirmado: `MAP.030.Produto` (banco `POS_COST_PRICING`), com "Dimensão de Componentes"/"Dimensão de Produtos" (`ALL.D.Material_Controladoria`, `ALL.D.Material_Controladoria_Detalhe`) e botões `Atualizar Dimensões`/`Atualizar Mapa` (não clicados). **É de-para de códigos SAP ↔ dimensões internas do TM1** (produto, cliente, PEP, garantia, área) — master data, sem relação com registro individual de venda.

### Segurança → "Segurança Pricing"
3 abas: Segurança - User/Grupo, Segurança - Cubos, Segurança - Processos. Cubo de controle nativo `}ClientGroups` — matriz de permissões (usuários × grupos/papéis: ADMIN, SecurityAdmin, DataAdmin, Operations, GRP_CUSTO, etc.). Botão `Cria Grupo de usuários` (não clicado). **É administração de acesso do próprio PA** — sem relação com dados de precificação.

### Bloqueios
Nenhum. A sessão SSO expirou uma vez no meio da rodada (tela de login IBMid) — o Rafael refez o login manualmente e a exploração retomou sem problema.

### ✅ Conclusão — fase de exploração ENCERRADA
Mapas e Segurança confirmam o esperado (master data / administração de acesso) — nenhuma relação com "1 precificação de venda = 1 registro". **Todos os 7 blocos do menu principal foram mapeados** (Mapas, Simulador de Custos, Tabela de Preço Geral, Tabela de Preço Cliente, Tabela de Preço PEP, Pricing Governo, Segurança). O gap identificado nas Rodadas 3-4 se mantém: **não existe hoje nenhuma tela/cubo em PA pronto pra formalizar precificações de venda individuais** — a recomendação consolidada (3 pedidos pro GLPI, ver acima) está confirmada e pronta pra virar chamado.
