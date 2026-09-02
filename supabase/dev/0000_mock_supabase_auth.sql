-- =============================================================================
-- LOCAL TEST-ONLY MOCK of the parts of Supabase's built-in "auth" schema that
-- our migrations reference (auth.users, auth.uid()). This file is NOT part
-- of the real migration set — Supabase already provides these in production.
-- It exists purely so migrations 0001-0004 can be validated against a plain
-- self-hosted Postgres instance.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique
);

-- In real Supabase, auth.uid() reads the JWT claim of the current request.
-- For local testing we make it a settable session variable so test scripts
-- can simulate "logged in as user X".
create or replace function auth.uid() returns uuid
language sql stable
as $func$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$func$;
