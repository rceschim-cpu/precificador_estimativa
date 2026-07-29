# Rascunho de chamado — Integração Precificador ↔ IBM Planning Analytics (Cognos/PA)

> Rascunho pra você revisar e ajustar antes de abrir. Ninguém abre isso
> automaticamente — é texto pronto pra copiar/colar (ou adaptar) no GLPI, ou
> pra usar como base numa conversa direta com quem administra o PA/Pricing,
> se preferir esse caminho antes de formalizar chamado. Baseado no
> mapeamento completo (5 rodadas) em `docs/cognos-integracao/RESULTADOS.md`.

## Título sugerido
Integração Precificador (app de precificação tributária) com IBM Planning Analytics — leitura de índices e gravação de precificações formalizadas

## Contexto / motivação
O Precificador (calculadora tributária da área Pricing & Costs, hoje em
Piloto) precisa passar a usar o IBM Planning Analytics (app interno
"Precificação") como (1) fonte dos índices tributários/comerciais já
cadastrados lá e (2) destino de gravação — cada precificação realizada
formalizada como um registro consultável, hoje feito de forma manual/
dispersa.

Foi feito um mapeamento técnico do ambiente (só leitura, nenhuma alteração)
que já responde boa parte do "onde" — falta confirmação e apoio de quem
administra o PA pra fechar os pontos que exigem mudança de modelo de dados
ou credenciais.

## O que já confirmamos (não precisa reconfirmar)
- App "Precificação" no PA, com 7 blocos mapeados: Mapas, Simulador de
  Custos, Tabela de Preço Geral/Cliente/PEP, Pricing Governo, Segurança.
- **Fonte dos índices tributários**: cubo `PCF.230.Premissa_Impostos`
  (banco `POS_COST_PRICING`), por NCM × UF × Centro × Versão × Período ×
  regime tributário — tem ICMS, ICMS Presumido, ISS, IPI, PIS/COFINS,
  DIFAL e IBS.
- **API REST pública existe e funciona**: TM1 REST API v1 (OData padrão
  IBM), `/prism/harmony/tm1serverexplorer/api/v1/Servers('<db>')/Cubes('<cubo>')/Views('<view>')`
  — confirmamos leitura (200) em cubos com view `Default` publicada.

## Os 3 pedidos

### 1. Confirmar que não existe hoje uma tela/cubo pra "1 venda precificada = 1 registro"
Mapeamos os 7 blocos do menu principal do app "Precificação" e nenhum
representa esse conceito — Tabela de Preço Geral/Cliente/PEP são tabelas em
lote (índice por segmento/projeto, cada uma com pipeline próprio pro SAP);
Simulador de Custos é sobre custo de importação; Mapas é de-para de
cadastro; Segurança é administração de acesso. **Pedimos confirmação de
quem administra o PA**: existe alguma tela fora desse menu (ou um uso não
óbvio de uma das telas existentes) que sirva pra isso? Se não, seguimos pro
pedido 2.

### 2. Desenho de um cubo novo dedicado (se o gap acima for confirmado)
Um cubo (sugestão de nome: `PCF.xxx.Precificacoes_Formalizadas`, mas o time
de PA decide a nomenclatura/numeração adequada) com dimensões:
- Produto / NCM
- Cliente
- Canal
- UF de destino
- Data da precificação
- Preço final
- Margem (ML e/ou MC)
- Usuário que precificou
- Origem/modalidade (MAO/IOS/CWB × CKD/SKD/CBU) — contexto específico do
  Precificador

**Importante**: pedir que esse cubo tenha uma **view TM1 nomeada e
publicada** (não só a view "Default" implícita) — confirmamos que pelo
menos um cubo existente (`PCF.011.Aberturas_PO`) NÃO tem view `Default`
acessível pela API pública (retornou 404), a grade dele é montada
dinamicamente via MDX interno. Um cubo novo feito pra ser consumido
externamente precisa dessa view desde o início.

### 3. Conta de serviço / API key para uso por backend
Todo o mapeamento foi feito com a sessão SSO de um usuário humano logado.
O Precificador vai chamar essa API sem humano no loop — perguntar qual é o
mecanismo correto (conta de serviço dedicada, API key, client OAuth2, etc.)
pra autenticação backend-to-backend contra o TM1 REST API v1.

## Evidência / anexo
Log técnico completo (5 rodadas, com endpoints, cubos e telas mapeadas):
`docs/cognos-integracao/RESULTADOS.md` no repositório do Precificador
(`precificador_estimativa`, branch `main`). Pode ser anexado ou linkado se
o processo aceitar referência a repositório interno.

## Observação
Nenhuma ação de escrita foi feita no PA durante o mapeamento — foi
inteiramente exploração via navegador, sem clicar em nenhum botão de
gravação/envio/aprovação.
