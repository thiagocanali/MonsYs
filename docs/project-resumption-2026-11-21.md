# Retomada do MonsYs — 21/11/2026

## Fontes e limites

Revisados o histórico disponível desta conversa, o `main` em `0acac3c9`, todos os módulos de frontend, domínio, APIs e persistência, migrações, testes, CI e documentação. Outras conversas privadas não estão acessíveis nesta sessão. A especificação descreve objetivos futuros; mensagens de commit e documentos históricos não provam ativação em produção.

O workspace desta sessão começou vazio. Uma cópia limpa de `main` foi obtida; nenhum trabalho local anterior foi sobrescrito. O PR #31 foi incorporado em 12/11. A pesquisa de PRs abertos retornou zero resultados antes deste ciclo.

## Objetivo e arquitetura preservados

MonsYs é uma plataforma multiempresa para transformar telemetria em eventos, incidentes e ações auditáveis. Mantidos React/TypeScript no frontend, funções Node.js na Vercel, Better Auth para identidade e `pg` para PostgreSQL. Autorização por organização/papel ocorre no backend; não há acesso direto do navegador ao banco. O projeto Neon exclusivo existe; a migração da conexão Vercel para ele ainda requer evidência de homologação e aprovação de produção.

A especificação prevê agent Windows em Go, runbooks e execução de ações. Atualmente há modelos de domínio e endpoints de provisionamento/heartbeat, mas não há código do executável Windows nem transporte real de execução de comandos. O painel mostra incidentes e timelines persistidos, não o catálogo completo planejado.

## Últimos commits conferidos no código

| Commit / PR | Mudança efetiva |
|---|---|
| `0acac3c` / #51 | `AGENTS.md` e concorrência da CI: cancelar execuções antigas de PR sem cancelar checks de main |
| `0f1fac2` / #50 | Testes de identidade de sessão malformada e rechecagem após logout |
| `581931e` / #49 | Adaptador PostgreSQL para estado de regras, migração aditiva e opt-in `RULE_EVALUATION_PERSISTENCE=postgres` |
| `f57333f` / #48 | Falhas de autenticação/organização tratadas sem exposição de erros internos; regressões cobertas |
| `edf810e` / #40 | Migrações neutras em `database/migrations/`, paridade com histórico legado e isolamento de dois usuários nos testes |
| `7227c6c` / #45 | Validação da identidade recebida no navegador |
| `9c3eb39` / #44 | Bloqueio de troca de modo durante autenticação e limpeza de senha ao trocar formulário |

Também conferidos os ajustes anteriores de feedback, verificação de sessão persistida e preservação da sessão quando a consulta de organizações falha. Esses fluxos não foram refeitos nesta retomada.

## Estado observado

- `main` limpo na obtenção, com deployment Vercel de produção READY associado a `0acac3c`. READY confirma construção/publicação, não um teste autenticado ponta a ponta. Não foi alterada configuração de produção.
- Neon `noisy-feather-61781482`, branch `br-lively-pond-b6f3wt11`, banco `monsys`: **16 tabelas** de aplicação, todas com RLS; a consulta de prontidão não encontrou grants a PUBLIC, `anon` ou `authenticated`, incluindo privilégios herdados pelos papéis de navegador.
- **`rule_evaluation_states` não existe nesse banco remoto.** A quarta migração está no Git; ela não foi aplicada nesta sessão.
- O papel usado pelo conector Neon passou no diagnóstico de acesso. Isso não identifica nem valida o papel de conexão usado pela Vercel.
- O valor efetivo de `RULE_EVALUATION_PERSISTENCE` na Vercel não foi consultado. O código usa memória por padrão e só seleciona o adaptador PostgreSQL mediante opt-in.
- O Supabase histórico não foi alterado nem reinspecionado nesta sessão. O alerta de exposição de 11/11 permanece histórico e não deve ser descrito como uma constatação atual sem nova consulta.

## Concluído, em andamento e pendente

**Implementado no código e coberto por testes:** autenticação, sessão/logout, organizações e roles, isolamento entre tenants, provisionamento de tokens de agent, heartbeat, incidentes/timeline, migrações portáveis e adaptador durável de regras.

**Em andamento:** conciliação e homologação da conexão com o novo Neon; aplicação da quarta migração e ativação verificada do adaptador. A documentação de 15/11 continha referências a PRs então abertos e tarefas que depois foram incorporadas; os commits acima são a fonte atual para essas implementações.

**Pendente:** transação única entre amostra, avaliação e incidente; regras versionadas por organização; execução real do agent; auditoria automática, rotação de credenciais e limites de ingestão; catálogo e telas completas de dispositivos/regras/runbooks. O estado de regra já tem transação e lock próprios, mas o endpoint ainda insere amostra e incidente em etapas separadas: falha parcial seguida de retry pode perder o processamento do alerta.

## Continuidade deste ciclo

O último avanço funcional relevante foi o adaptador PostgreSQL em #49, seguido por testes de autenticação e regras de trabalho protegido. A tarefa lógica é fechar a lacuna de prontidão antes do cutover, não recriar o adaptador ou trocar a arquitetura.

Entregue nesta retomada:

1. Inventário e comparação da conversa, Git, código e banco remoto, somente leitura.
2. `npm run db:check`: verificação explícita de homologação usando `DATABASE_CHECK_URL`; sem fallback para `DATABASE_URL` e sem carregamento automático de `.env`.
3. Checagem de 17 tabelas, RLS, privilégios públicos/efetivos dos papéis de navegador, acesso CRUD do papel de conexão e colunas/chave da tabela de estado.
4. Testes unitários e PostgreSQL real para schema completo/incompleto, RLS desativado, grants indevidos e papel bloqueado. Modificações de teste ocorrem apenas no banco descartável e são revertidas por ROLLBACK.
5. Atualização do contrato de estado de regras e deste plano de retomada.

O verificador consulta catálogos e não lê registros de clientes, aplica SQL de migração ou ativa flags. Saída 0 significa que os pré-requisitos inspecionados passaram; 1 indica bloqueios; 2 indica conexão/configuração insuficiente. Não imprime URL, credenciais ou mensagens cruas do driver. Ele não substitui comparação completa de constraints/índices de todas as tabelas nem o teste autenticado da aplicação.

Para executar, injete `DATABASE_CHECK_URL` pelo gerenciador de segredos do ambiente de homologação e rode `npm run db:check`. Não cole a URL no chat ou em comandos versionados. O diagnóstico de acesso é conservador para o modelo atual: um papel com políticas RLS customizadas, mas sem acesso como owner/bypass, requer revisão específica e pode ser apontado como não pronto.

## Validação desta retomada

- Antes das mudanças: typecheck, build e auditoria aprovados; 89 testes passaram e 4 de integração ficaram sem executar por ausência do banco local.
- Depois: **100 testes aprovados, sem skips**, com PostgreSQL 17 descartável inicializado com as quatro migrações; typecheck, build e auditoria sem vulnerabilidades conhecidas aprovados.
- CLI contra o banco local completo: `ready: true`, 17 tabelas, sem bloqueios, schema da tabela de estado válido.
- CLI contra porta local indisponível: código 2 e mensagem genérica, sem dados de conexão.
- A consulta do verificador foi executada via Neon MCP no banco remoto: faltou a tabela de estado; as 16 tabelas existentes passaram nos checks de RLS/grants/acesso do papel MCP. Nenhum dado remoto foi alterado.

## Próxima ação após revisão

Preparar homologação isolada no projeto Neon existente; comparar o schema da branch com as quatro migrações; aplicar somente a migração pendente nessa branch de teste; executar o verificador com o papel que a aplicação realmente utilizará; validar cadastro/login/logout, organização, isolamento, heartbeat e avaliação concorrente com persistência ligada. Somente depois planejar o cutover aprovado de produção. Preservar a flag e a conexão atuais até essa verificação.

Mudanças de autenticação, banco e produção exigem validação e revisão explícita segundo `AGENTS.md`. Este ciclo prepara diagnóstico e testes; não integra automaticamente o PR nem altera produção.
