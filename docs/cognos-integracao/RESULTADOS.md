# Resultados do mapeamento — IBM Planning Analytics (Cognos/PA)

> Log cumulativo. Cada rodada de exploração do agente Cowork vira uma seção
> nova aqui (mais recente no topo). Preenchido pelo Claude desta conversa a
> partir do que o agente Cowork reportar — não editado diretamente pelo
> agente de mapeamento.

## Status atual

- [ ] API REST confirmada (versão, base URL)
- [ ] Mecanismo de autenticação p/ uso por backend identificado
- [ ] Cubo/dimensão de índices tributários identificado
- [x] Cubo/dimensão (ou gap) para formalização de precificações — **candidatos identificados, falta confirmar qual serve**: Tabela de Preço Geral (é lote/bulk, não individual), Tabela de Preço Cliente e Tabela de Preço PEP (ainda não exploradas, parecem mais próximas de "1 precificação = 1 registro")
- [x] Workspace `pa-plan-contribute` da URL inicial compreendido — é a aplicação estruturada "Precificação" (não um formulário solto), com menu principal de 6 blocos
- [ ] Decisão: vale abrir chamado GLPI pedindo API/credencial de serviço?

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
