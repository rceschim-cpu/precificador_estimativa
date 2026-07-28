# Briefing — Mapeamento IBM Planning Analytics (Cognos/PA) para o Precificador

> Cole este arquivo inteiro como primeiro prompt do agente no Cowork. Ele foi
> escrito pra ser autossuficiente — o agente não tem acesso a esta conversa.

## Contexto (por quê)

O Precificador (calculadora tributária React/Vite da Positivo — repo
`precificador_estimativa`) precisa passar a usar o **IBM Planning Analytics**
(PA — família Cognos/TM1, NÃO o Cognos Analytics clássico) para duas coisas:

1. **Fonte de dados** — os índices tributários/comerciais (hoje mantidos em
   Supabase/planilhas) já estão documentados/cadastrados no PA. Precisamos
   ler esses dados de lá.
2. **Destino de gravação** — um botão "subir precificação" no Precificador
   que formaliza cada precificação realizada como um registro no PA,
   deixando-a cadastrada e disponível para consulta por outras áreas.

URL de partida (já autenticada via SSO no navegador do Cowork):
```
https://positivo.planning-analytics.cloud.ibm.com/?perspective=pa-plan-contribute&id=cf56bb65-a0b4-4b22-87d8-555912d552a8&workUnitId=687435b75bde364cee178036&assetType=application&dashboardId=2fb07d20-41f2-4173-a291-734852bfa70a
```
O parâmetro `perspective=pa-plan-contribute` sugere que esse workspace já é um
formulário de **Contribute** (o módulo do PA pra ENTRADA/submissão de dados em
cubos de planejamento) — pode ser exatamente o mecanismo que precisamos pra
"formalizar precificação". Vale investigar esse workspace específico com
atenção antes de sair procurando outros lugares.

## REGRA ABSOLUTA — SOMENTE LEITURA

**NÃO clique em nenhum botão de salvar/enviar/submeter/aprovar/gravar.
NÃO preencha formulários com dados novos. NÃO altere nenhuma célula, cubo,
dimensão ou configuração. Esta é uma tarefa de EXPLORAÇÃO E DOCUMENTAÇÃO,
não de execução.** Se qualquer ação parecer que vai gravar/alterar dado real
(mesmo que pareça reversível), PARE, não clique, e reporte a situação em vez
de prosseguir.

Você está numa sessão de navegador já logada (SSO). Não precisa e não deve
tentar inserir credenciais em lugar nenhum.

## O que investigar (nessa ordem)

### 1. A tela de partida (`pa-plan-contribute`)
- O que esse workspace mostra? É uma tabela/formulário editável (grid de
  contribuição)? Quais colunas/dimensões aparecem (produto, canal, UF,
  data, valores)?
- Isso parece compatível com o conceito de "uma precificação = uma linha/
  registro formalizado"? Descreva a estrutura de dados que você vê.
- **NÃO edite nem envie nada nessa tela.** Só observe e descreva.

### 2. Rede (Network) — descobrir a API real
- Abra o DevTools (F12) → aba Network, ou peça pro agente usar a ferramenta
  de leitura de requisições de rede disponível no Cowork/Claude in Chrome.
- Navegue normalmente pela interface (trocar de página, expandir um cubo,
  abrir um dashboard) e capture as chamadas XHR/fetch que a PRÓPRIA
  interface do PA faz para carregar/enviar dados.
- Anote: método HTTP, path completo, headers relevantes (sem copiar tokens/
  cookies inteiros — só indicar que existe um Bearer token / cookie de
  sessão), e um resumo do payload de resposta (estrutura, não o dado
  sensível completo).
- Isso revela os endpoints reais da REST API do PA (tipicamente baseada em
  OData, ex. padrões como `/api/<nome-do-servidor-tm1>/v0/...` ou
  `/api/framework/...` — mas confirme o que você REALMENTE vê, não assuma).

### 3. Documentação de API publicada pela própria instância
- Procure por um menu de administração ("PA Administration", engrenagem de
  configurações, "Developer", "API Reference").
- Teste (só navegar, não autenticar de novo) se existe uma página tipo
  Swagger/OpenAPI explorer publicada pela instância — muitas instalações do
  PA expõem uma em caminhos como `/api/v0/help`, `/api/framework/doc/`, ou
  acessível pelo próprio menu de admin. Reporte a URL exata se encontrar.

### 4. Modelo de dados (cubos/dimensões)
- Identifique o(s) nome(s) do(s) cubo(s) TM1 que contém os índices
  tributários/comerciais hoje usados (que fonte alimenta o Precificador).
- Identifique se já existe (ou precisaria ser criado) um cubo/dimensão
  destinado a registrar precificações formalizadas — dimensões esperadas:
  produto/NCM, canal, cliente, UF destino, data, preço final, margem, quem
  precificou.
- Anote nomes exatos de cubo/dimensão/processo TI que encontrar — vamos
  precisar deles pra desenhar a integração.

### 5. Autenticação para uso por um SISTEMA (não por um usuário logado)
- O que você observa hoje é a sessão de um usuário humano (SSO). Precisamos
  saber como um BACKEND (o Precificador, sem humano no loop) autenticaria
  nessa API — normalmente é uma API key de serviço, um client OAuth2, ou uma
  conta técnica. Não dá pra testar isso diretamente sem credencial própria,
  mas registre qualquer indício (menção a "API Key", "Service Account",
  "OAuth client" em telas de admin) que ajude a saber ONDE pedir isso depois.

## Como reportar (formato de saída)

Ao final de cada etapa investigada, responda em texto corrido (não precisa
JSON) cobrindo:

1. **O que foi encontrado** — direto, com URLs/paths/nomes exatos.
2. **Screenshot ou trecho de rede relevante** (se a ferramenta permitir
   anexar/mostrar).
3. **Nível de confiança** — isso é confirmado (você viu com os próprios
   olhos) ou é inferência/hipótese?
4. **Bloqueios** — algo pediu permissão que você não tem, ou uma ação que
   você recusou por ser destrutiva/de escrita?
5. **Próxima pergunta em aberto** — o que ainda falta descobrir.

## Fluxo de trabalho (importante)

Este é um processo iterativo: o usuário (Rafael) vai copiar sua resposta e
colar numa outra conversa (com o Claude que já conhece o projeto
Precificador), que vai interpretar o resultado e devolver o próximo prompt
pra você continuar. Não tente concluir tudo de uma vez — foque em UMA etapa
por resposta, reporte, e aguarde o próximo prompt.
