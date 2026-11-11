# Revisão de engenharia — 11/11/2026

## Escopo e estado real

Revisão de todos os módulos versionados: frontend, domínio, APIs, persistência, autenticação, dependências, CI e especificação. Inspeção somente de leitura dos projetos conectados na Vercel e no Supabase. A especificação descreve uma plataforma maior que o software atualmente implementado; esta entrega corrige a base funcional e registra as próximas etapas sem simular funcionalidades inexistentes.

### Infraestrutura observada

- Repositório: `thiagocanali/MonsYs`, branch original `main` no commit `5112a7a`.
- Vercel: projeto `monsys`, Node.js 24; configuração de `DATABASE_URL` pertence a uma integração **Neon**, junto de `NEON_PROJECT_ID` e variáveis PostgreSQL. Foram consultados somente metadados; nenhum segredo foi descriptografado.
- Supabase: projeto MonsYs, PostgreSQL 17. O histórico contém `20261111105335_auth_foundation`, com seis tabelas: `user`, `session`, `account`, `verification`, `organizations`, `organization_members`. O arquivo dessa migração foi recuperado do histórico, preservando os dados SQL.
- As tabelas operacionais não existem nesse projeto Supabase. Isso não prova que estejam ausentes na Neon: o banco da integração Vercel não foi inspecionado.
- **Falha crítica no Supabase:** as seis tabelas estão sem RLS, e os papéis `anon` e `authenticated` possuem permissões de leitura e escrita, inclusive sobre sessões e contas. [Remediação oficial](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- Não foram alterados dados, configuração, permissões ou schema de nenhum banco remoto nesta entrega.

## Correções implementadas

| Área | Problema observado | Resultado |
|---|---|---|
| Tipos | `tsconfig` excluía TSX; interface referenciava `demoAgent` inexistente | TS e TSX verificados; tipos React e Vite declarados; referência removida |
| Interface | Métricas e eventos fictícios, botões inertes e fluxo demonstrativo misturados com operações reais | Painel exibe até 200 incidentes reais e detalhes; estados vazio, erro, carregamento e retry explícitos |
| Sessão | Falhas de rede e respostas de organização inválidas podiam causar exceções não tratadas | Sessão e memberships carregados com tratamento de erro; logout só limpa sessão após sucesso |
| Organização | Dados da organização anterior permaneciam na tela ao trocar o seletor | Lista e seleção limpas imediatamente; requisições anteriores canceladas |
| Rotas | Frontend usa `/api/auth/*`, mas faltava roteamento das subrotas | Rewrite explícito para o Better Auth; exports `fetch` conforme padrão Web da Vercel |
| Desenvolvimento | Vite atendia frontend sem os endpoints da aplicação | Servidor local integra os mesmos handlers usados na Vercel, incluindo cookies múltiplos |
| Heartbeat | `{}` ou métricas parciais podiam passar pela validação | CPU, memória e disco obrigatórios, finitos e no intervalo 0–100; strings obrigatórias com limite |
| Erros | Exceções de banco retornavam suas mensagens ao cliente | Erros de validação identificados; falhas inesperadas retornam mensagem genérica e HTTP 500 |
| Segurança web | Mutações com cookie não verificavam origem | Origem estrangeira ou opaca rejeitada nos endpoints humanos; APIs sem cache |
| Regras | Amostra antiga normal podia limpar um alerta já disparado | Amostras antigas ignoradas antes de alterar a janela; testes de regressão |
| Banco | Pools separados em cada repositório e conexões sem timeout | Pool compartilhado por instância com limite e timeouts; falhas de conexões ociosas tratadas |
| Tenancy | Agents sem vínculo estrutural à organização | Nova fundação contém organização no agent e FK composta nas credenciais; SQL alinhado |
| Idempotência | IDs de telemetria colidiam entre organizações | Chave `(organization_id, id)` na fundação e no insert |
| Consultas | Listagem de incidentes ilimitada e falhas de runbooks ocultadas | Paginação limitada e ordenação estável; falhas reais de consulta propagadas |
| Dependências | Vite vulnerável e mocker do Vitest com avisos moderados | Vite 8.3.8, Vitest 5.0.3, versões diretas fixadas; auditoria sem vulnerabilidades conhecidas |
| Repositório | Build gerado versionado, sem ignore ou instruções úteis | `dist` removido do Git; ignores de build, segredos e scratch; README e exemplo de ambiente |
| CI | Testes somente com mocks e runtime diferente da produção | Node 24, PostgreSQL 17 descartável, testes integrados e auditoria de dependências |

## Migrações e modelo de acesso

1. `20261111105335_auth_foundation.sql`: cópia do histórico remoto já existente. Não reaplicar em um banco que já possui essa fundação.
2. `20261111234242_operational_foundation.sql`: cria as dez tabelas operacionais, índices, checks, unicidade de dispositivo por organização e FK de credencial/agent/organização. RLS habilitado desde a criação e acesso dos papéis públicos revogado.
3. `20261111234324_lock_down_server_tables.sql`: habilita RLS e revoga acesso público às seis tabelas existentes, sem apagar ou recriar dados.

O Better Auth utiliza conexão PostgreSQL do servidor e cookies próprios. Seus usuários **não são** usuários de `auth.users` do Supabase. Por isso, políticas baseadas cegamente em `auth.uid()` não representariam esta identidade. O modelo atual é **acesso exclusivamente pelo backend**, com autorização por organização na API. RLS sem políticas bloqueia o Data API; revogar privilégios também impede operações como TRUNCATE, não cobertas por RLS. Os comandos verificam a existência de `anon`/`authenticated` para funcionar também no PostgreSQL sem esses papéis.

A conexão do backend precisa ser do proprietário das tabelas ou de um papel explicitamente autorizado e testado. Não habilitar `FORCE ROW LEVEL SECURITY` nem inventar políticas públicas para resolver erros de permissão. O arquivo `database/auth.generated.sql` é uma referência gerada pelo Better Auth 1.7.18 contra o PostgreSQL descartável; não deve ser aplicado sobre a migração de fundação.

## Evidências de validação

- Typecheck completo: TS, TSX e testes incluídos nas pastas verificadas.
- Vitest: **65 testes aprovados**, incluindo PostgreSQL 17 real iniciado sem schema para testar a sequência das três migrações.
- Integração: cadastro Better Auth, cookie de sessão, organização e membership ADMIN, provisionamento de token, heartbeat com três amostras, incidente e duas entradas de timeline, detalhe de incidente e leituras sem sessão negadas.
- Segurança: token de agent rejeitado em outra organização, FK composta rejeita credencial cruzada, viewer não pode provisionar ou enviar telemetria, detalhe de outra organização retorna 404, `anon` e `authenticated` não leem sessões ou incidentes.
- Chromium: cadastro → sessão → criação de organização → painel vazio real → logout, sem erros JavaScript. Captura visual inspecionada localmente.
- Build Vite de produção aprovado; `npm audit` retorna zero vulnerabilidades conhecidas nesta revisão.
- Isso valida o ambiente descartável. Não representa migração nem validação ponta a ponta do banco remoto da Vercel.

## Plano de implantação

1. Conciliar a decisão de banco: manter Neon e inspecionar seu schema/histórico com conexão segura, ou migrar para Supabase com inventário e plano de transferência dos dados existentes.
2. Confirmar o papel real da conexão do backend, permissões e acesso de leitura/escrita com RLS. Não transportar credenciais em chat, Git ou parâmetros de comandos.
3. Comparar o schema real com as migrações; adaptar aditivamente se o banco já contiver tabelas operacionais. Não usar a fundação como script de reset.
4. Aplicar as migrações pendentes em ambiente de staging; testar cadastro, login, organização, incidentes e heartbeat pelo deployment da Vercel.
5. Publicar a versão validada e verificar os mesmos endpoints, incluindo `/api/health` e uma sessão autenticada. Manter rollback de código disponível; não apagar tabelas ao reverter código.

## Próximas tarefas priorizadas

### P0 — encerrar antes de considerar produção validada

- Conciliar Neon/Supabase e executar a remediação de acesso público no projeto Supabase identificado. O SQL está pronto e testado, mas a exposição remota permanece até sua aplicação.
- Inspecionar o schema do banco efetivamente usado pela Vercel e aplicar somente migrações compatíveis.
- Validar rewrite de autenticação e cookies no preview real; configuração de origem canônica em produção e preview.

### P1 — confiabilidade e segurança operacional

- Persistir estado de avaliação de regras em PostgreSQL com serialização entre instâncias. O engine ainda usa memória local; janelas de duração não sobrevivem a reinícios e instâncias diferentes não compartilham estado.
- Processar amostra, estado de regra, evento e incidente na mesma transação; hoje falha após inserir uma amostra pode deixar processamento parcial e o retry idempotente não refaz o evento.
- Persistir regras por organização com autorização e versão, em vez de aceitar definições enviadas no payload operacional.
- Definir vínculo de runbook/ação/resultado por tenant no banco; IDs em JSONB e relações indiretas ainda exigem evolução do modelo antes de expor APIs de execução.
- Implementar auditoria automática das mutações, rotação/revogação/expiração de tokens e limites de ingestão com estado compartilhado.
- Endurecer a conta do banco para menor privilégio com autorização por tenant em conexão do servidor, sem usar bypass como substituto dos checks da API.
- Definir intervalo máximo entre amostras e tolerância a relógio futuro/antigo no monitoramento.

### P2 — produto e operação

- Implementar agent Windows real, entrega segura de ações, aprovação e coleta de resultados; o domínio existente ainda não corresponde a execução remota implementada.
- Evoluir catálogo de dispositivos, regras e runbooks com APIs e telas reais; não restaurar navegação inerte como se estivesse pronta.
- Paginação navegável, filtros e indicadores agregados do servidor para além dos 200 incidentes recentes.
- Testes de UI permanentes na CI, acessibilidade, observabilidade de erros e política de retenção da telemetria.

Os documentos anteriores continuam como registro histórico e apontam para esta revisão quando suas afirmações ficaram desatualizadas.
