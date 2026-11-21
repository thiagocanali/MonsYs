# MonsYs

Console de monitoramento multiempresa em React/TypeScript, com APIs Node.js na Vercel, autenticação Better Auth e PostgreSQL.

## Desenvolvimento

Requer Node.js 24 e PostgreSQL 17. Instale com `npm ci`, copie `.env.example` para `.env.local`, configure a conexão e gere um `BETTER_AUTH_SECRET` aleatório de pelo menos 32 caracteres. Segredos ficam somente no ambiente.

Em um banco **novo e descartável**, aplique os arquivos de `database/migrations/` em ordem. O primeiro arquivo reproduz a migração `auth_foundation` recuperada do histórico do Supabase. Para bancos existentes, compare estrutura e histórico antes de executar SQL; não reaplique a fundação.

`npm run dev` inicia interface e APIs em `http://localhost:3000`. O servidor de desenvolvimento aceita conexões apenas locais. Cadastre uma conta e crie uma organização. O painel mostra os incidentes reais dessa organização e suas timelines.

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Para testar também migrações, autenticação e isolamento com PostgreSQL descartável local:

```sh
TEST_DATABASE_URL=postgresql://postgres:senha@localhost:5432/monsys_test npm test
```

O teste integrado recusa hosts remotos e nunca utiliza implicitamente `DATABASE_URL`. A CI provisiona seu próprio PostgreSQL 17.

## Implantação e banco

A Vercel compila o frontend e publica os endpoints de `api/` com handlers Web (`fetch`). A configuração encaminha `/api/auth/*` ao Better Auth. `DATABASE_URL`, `BETTER_AUTH_SECRET` e a URL canônica devem ser configurados no servidor; em previews, use a URL do próprio preview.

Em 15/11/2026 foi criado o projeto Neon independente `noisy-feather-61781482` (PostgreSQL 17, região `aws-sa-east-1`, banco `monsys`), com as três migrations da aplicação aplicadas e 16 tabelas com RLS habilitado. **A conexão de produção da Vercel ainda não foi alterada nem validada contra esse novo banco.** Consulte [migração para Neon](docs/neon-migration.md) antes de configurar qualquer ambiente.

Consulte a [revisão técnica e backlog priorizado](docs/engineering-review-2026-11-11.md) para evidências, limitações e plano de implantação.

## Prontidão da persistência de regras

A retomada de [21/11/2026](docs/project-resumption-2026-11-21.md) distingue o que está implementado da ativação remota. O adaptador PostgreSQL já existe; sua flag exige homologação e a quarta migração no banco alvo.

Injete `DATABASE_CHECK_URL` pelo gerenciador de segredos da homologação e execute `npm run db:check`. O comando só consulta catálogos, não aplica migrations nem altera a configuração da aplicação. Códigos: 0 = pré-requisitos inspecionados aprovados, 1 = bloqueios encontrados, 2 = configuração/conexão indisponível. Ainda é necessário testar a aplicação com seu papel real de conexão.
