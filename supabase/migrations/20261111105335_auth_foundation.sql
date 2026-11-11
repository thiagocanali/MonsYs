create table "user" (
  "id" text primary key not null,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create table "session" (
  "id" text primary key not null,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create index "session_userId_idx" on "session" ("userId");

create table "account" (
  "id" text primary key not null,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create unique index "account_provider_account_idx" on "account" ("providerId", "accountId");
create index "account_userId_idx" on "account" ("userId");

create table "verification" (
  "id" text primary key not null,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create index "verification_identifier_idx" on "verification" ("identifier");

create table "organizations" (
  "id" text primary key not null,
  "name" text not null,
  "slug" text not null unique,
  "created_at" timestamptz not null default current_timestamp,
  "updated_at" timestamptz not null default current_timestamp
);

create table "organization_members" (
  "organization_id" text not null references "organizations" ("id") on delete cascade,
  "user_id" text not null references "user" ("id") on delete cascade,
  "role" text not null check ("role" in ('ADMIN', 'OPERATOR', 'VIEWER')),
  "created_at" timestamptz not null default current_timestamp,
  primary key ("organization_id", "user_id")
);

create index "organization_members_user_id_idx" on "organization_members" ("user_id");
