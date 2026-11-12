# MonsYs

Console de monitoramento multiempresa em React/TypeScript, com APIs Node.js na Vercel, autenticação Better Auth e PostgreSQL.

## Desenvolvimento

Requer Node.js 24 e PostgreSQL 17. Instale com `npm ci`, copie `.env.example` para `.env.local`, configure a conexão e gere um `BETTER_AUTH_SECRET` aleatório de pelo menos 32 caracteres. Segredos ficam somente no ambiente.

Em um banco **novo e descartável**, aplique os arquivos de `supabase/migrations/` em ordem. O primeiro arquivo reproduz a migração `auth_foundation` recuperada do histórico do Supabase. Para bancos existentes, compare estrutura e histórico antes de executar SQL; não reaplique a fundação.

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

A inspeção de 11/11/2026 encontrou **uma integração Neon na Vercel e um projeto MonsYs separado no Supabase**. A origem do `DATABASE_URL` precisa ser conciliada antes de aplicar migrações no ambiente real. As novas migrações foram testadas localmente; não presuma que já foram executadas nos provedores.

Consulte a [revisão técnica e backlog priorizado](docs/engineering-review-2026-11-11.md) para evidências, limitações e plano de implantação.
