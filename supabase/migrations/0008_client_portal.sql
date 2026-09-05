-- =============================================================================
-- Syncora — Migration 0008: Client Portal links
--
-- Adds project_portal_links: one row per project that a workspace member has
-- chosen to expose via a public, no-login-required "client portal" link.
-- The token is the only thing that gates access — there is deliberately no
-- authentication for the portal itself (that's the point: the client can
-- open the link without an account), so the token must be unguessable
-- (generated with gen_random_uuid(), not a short/sequential id).
--
-- What the portal is allowed to show is intentionally narrow and is
-- enforced in application code (app/api/portal/[token]/route.ts), not here:
-- project name/description/progress, tasks reduced to {title, status,
-- milestone} only (no description, no assignee, no comments), and files
-- metadata (name/size) with per-download signed URLs. Nothing else in the
-- schema (activity log, comments, other projects) is ever exposed through
-- this token.
-- =============================================================================

create table if not exists public.project_portal_links (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null unique references public.projects(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    token uuid not null default gen_random_uuid() unique,
    is_enabled boolean not null default true,
    created_by_id uuid references public.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_portal_links_token on public.project_portal_links(token);
create index if not exists idx_portal_links_workspace on public.project_portal_links(workspace_id);

create trigger trg_portal_links_touch before update on public.project_portal_links
  for each row execute function public.touch_updated_at();
