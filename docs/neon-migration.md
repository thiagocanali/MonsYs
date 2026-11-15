# Migração MonsYs para Neon PostgreSQL — 15/11/2026

## Estado verificado
- Organização Neon existente: `org-bold-mountain-42921987`.
- Projeto exclusivo MonsYs: `noisy-feather-61781482`.
- Região: `aws-sa-east-1` (São Paulo); PostgreSQL 17.
- Branch principal: `main`; banco: `monsys`.
- As três migrations em `database/migrations/` foram aplicadas ao banco novo em transações.
- Consulta de catálogo retornou **16 tabelas**, todas com RLS habilitado.
- O projeto Supabase original **não foi apagado ou alterado**.
- O ambiente de produção Vercel **não foi modificado**. Não presumir que usa este novo Neon.
- O CI atual usa PostgreSQL 17 descartável; não usa dados do Neon remoto.

## Arquitetura e autorização
O frontend React não conecta diretamente ao banco. As APIs Node usam `pg` com queries parametrizadas e Better Auth para cadastro/sessão. Organizações e recursos são autorizados no backend. A conexão SQL é do servidor, nunca exposta no navegador. RLS está habilitado sem políticas públicas; acesso público às tabelas foi revogado. O papel proprietário das tabelas pode acessá-las; por isso, **a autorização de tenant depende também dos filtros e checagens nas APIs**.

Não há `@supabase/supabase-js` nas dependências diretas atuais. A pasta legada `supabase/migrations/` permanece temporariamente para preservar o histórico; os testes de integração passam a executar `database/migrations/`. Os arquivos idênticos em `database/migrations/` são o caminho neutro de provedor. Não executar ambos os conjuntos no mesmo banco.

## Configuração segura
- `DATABASE_URL`: connection string PostgreSQL Neon **com SSL obrigatório**, preferencialmente pooled para funções serverless. Guardar apenas como secret do ambiente.
- `BETTER_AUTH_SECRET`: segredo aleatório de 32+ caracteres, não versionado.
- `BETTER_AUTH_URL`: URL canônica de cada ambiente.
- `TEST_DATABASE_URL`: exclusivamente banco local descartável de testes; nunca apontar para produção.

Em `src/server/database.ts`, o pool usa no máximo 5 conexões por instância e timeouts. Verificar SSL na connection string e configuração do provedor antes do cutover. Não copiar segredos para arquivos Git ou logs.

## Aplicação do schema em banco vazio
Aplicar `database/migrations/` na ordem numérica **uma única vez**. Os scripts criam tabelas e índices, não são idempotentes. Em bancos existentes, comparar o schema antes de qualquer alteração. As migrations foram aplicadas ao Neon novo em 15/11/2026; **não reaplicar** nesse projeto.

## CI, deploy e rollback
Executar `npm ci`, `npm run typecheck`, `npm test`, `npm audit --audit-level=moderate` e `npm run build`. GitHub Actions é a validação primária; previews Vercel apenas para homologação. A regra de ignored build da Vercel reserva previews para `preview/*` e mantém `main` para produção. Não criar previews em cada commit.

Antes do cutover: inspecionar os metadados da conexão de produção existente, configurar secrets por ambiente sem revelar valores, testar cadastro, login, logout, organizações, isolamento entre usuários, agentes, incidentes e healthcheck num ambiente isolado. Exigir autorização para alterar produção. Manter a configuração anterior disponível para rollback e preservar o banco original.

## Registro de validação de 15/11/2026
- CI #63: aprovado no commit `45417abc`, incluindo migrations neutras e validações de organização no PostgreSQL descartável.
- Teste adicional de isolamento entre dois usuários reais de Better Auth implementado na branch da PR #40; requer CI do HEAD que contém o teste para ser considerado validado.
- Nenhum teste de ponta a ponta foi executado contra o Neon remoto. O teste de integração bloqueia deliberadamente bancos que não sejam `localhost`/`127.0.0.1`.

## Planejamento vivo (15/11/2026)

| Prioridade | Tarefa | Estado | Evidência / dependência | Próxima ação |
|---|---|---|---|---|
| P0 | Schema PostgreSQL Neon | Validada | 16 tabelas, 16 RLS, 16 FKs, 37 índices, zero grants públicos | Preservar schema |
| P0 | Isolamento entre dois usuários | Em andamento | Teste integrado ampliado com acesso do proprietário e negação de acesso anônimo; erro de sintaxe do CI #69 corrigido | Exigir CI do HEAD atual |
| P0 | API de organizações resiliente | Validada no HEAD `3417b0e7` da PR #41 | CI #67 aprovado | Revisão e merge autorizado |
| P0 | Conexão da aplicação ao Neon novo | Bloqueada | Integração Vercel atual não conciliada; produção não autorizada | Validar staging sem alterar produção |
| P1 | Evitar divergência das migrations | Em andamento | Teste de paridade adicionado no commit `9a9041ec` | Conferir CI do HEAD |
| P1 | Autenticação e permissões no Neon remoto | Pendente | Não executar testes destrutivos ou de cadastro em produção | Criar ambiente de homologação isolado |
| P1 | Quota de previews Vercel | Em andamento | Status Vercel `build-rate-limit`; ignored build já configurado | Validar política sem forçar deploy |

## Execução em lotes — ciclo de 15/11/2026
1. Revisadas PRs #40/#41 e execução #69: falha de typecheck por parênteses ausentes no teste de isolamento; corrigida na branch da PR #40.
2. Auditado o Neon remoto com SQL somente leitura: 16 tabelas, 16 tabelas com RLS, 16 FKs e 37 índices; sem mudança de dados.
3. Ampliado teste de isolamento com acesso positivo do proprietário e rejeição de listagem anônima.
4. Reforçada a verificação de RLS para exigir explicitamente 16 tabelas (evita aprovação em schema vazio).
5. Adicionado teste de paridade de migrations na PR #40; execução final depende de CI no HEAD mais recente.

## Pendências
1. Conciliar a integração Neon preexistente na Vercel com o projeto exclusivo recém-criado; não sobrescrever automaticamente `DATABASE_URL`.
2. Testar conectividade SSL, operações CRUD e autorização real no novo banco com credenciais de ambiente adequadas.
3. Validar funcionalidades ponta a ponta em preview deliberado, sem consumir cota em pushes intermediários.
4. Após cutover aprovado, remover referências históricas Supabase sem perder migrations nem cobertura de testes.
5. Definir política de backups, recuperação e restauração testada. O Neon oferece histórico de branches, mas isso não substitui um plano de recuperação validado.
