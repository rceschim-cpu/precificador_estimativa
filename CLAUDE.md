\# CLAUDE.md — Positec Calculadora Tributária



\## Projeto

Calculadora tributária React/Vite — Positivo Tecnologia (Positec)

Arquivo principal: `src/App.jsx` (single file, \~3400 linhas)

Stack: React 18, Vite, JSX puro (sem TypeScript, sem bibliotecas externas)



\## Deploy

Vercel → GitHub branch `main` — deploy automático após push

Repositório: https://github.com/rceschim-cpu/precificador\_estimativa



\## Regras obrigatórias

\- NUNCA remover funcionalidades existentes

\- NUNCA alterar fórmulas tributárias sem confirmação explícita do usuário

\- SEMPRE validar JSX antes de commitar (babel parse)

\- SEMPRE fazer git pull antes de editar

\- Commitar e fazer push somente após aprovação do usuário

\- Mensagens de commit em português



\## Contexto tributário (não alterar sem confirmar)

\- Regime: Lucro Real, PIS/COFINS não-cumulativo

\- Plantas: MAO (Manaus/ZFM), IOS (Bahia), CWB (Paraná)

\- P/C efetivo = P/C nominal × (1 − aliqInter% − DIFAL%)

\- P/C subvenção = 9,25% × crédito presumido% (sempre custo, não economia)

\- Margem Gerencial: sempre impacta ML; impacta MC só quando toggle ON



\## Estrutura do App.jsx

\- Auth system (login, perfis dinâmicos, gestão de usuários)

\- Calculadora tributária (tabs: Perfil, Importação, PPB, Produção, Índices, Venda, ST)

\- BreakdownPanel colapsável (lado esquerdo)

\- ModalRegistros (salvar/carregar com pastas e subpastas)

\- MultiTab (múltiplas abas de precificação)

\- PainelComparativo (modal de comparação entre abas)

