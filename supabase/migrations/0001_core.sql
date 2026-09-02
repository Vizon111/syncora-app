-- =============================================================================
-- Syncora — Migration 0001: Core tables (extensions, users, workspaces, members, projects)
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- USERS
-- Mirrors auth.users (Supabase Auth). We keep a public.users profile table
-- rather than reading auth.users directly from the app, because auth.users
-- is not meant to be queried by client code and doesn't carry our app-level
-- profile fields (color, status, etc).
-- ---------------------------------------------------------------------------
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email varchar(255) unique not null,
    name varchar(255) not null,
    avatar_url text,
    color varchar(32) not null default '#3b82f6',
    status varchar(16) not null default 'offline' check (status in ('online', 'idle', 'offline')),
    last_active_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_users_email on public.users(email);

-- ---------------------------------------------------------------------------
-- WORKSPACES (tenant root)
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
    id uuid primary key default uuid_generate_v4(),
    name varchar(255) not null,
    slug varchar(255) unique not null,
    avatar text,
    owner_id uuid not null references public.users(id) on delete restrict,
    plan varchar(32) not null default 'pro' check (plan in ('free', 'pro', 'enterprise')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);

-- ---------------------------------------------------------------------------
-- WORKSPACE MEMBERS (RBAC root: owner / admin / member / viewer)
-- This table is the single source of truth for tenant membership and role.
-- Every RLS policy on every other table ultimately joins back to this table.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    role varchar(32) not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
    joined_at timestamptz not null default now(),
    unique (workspace_id, user_id)
);
create index if not exists idx_wm_tenant on public.workspace_members(workspace_id, user_id);
create index if not exists idx_wm_user on public.workspace_members(user_id);

-- ---------------------------------------------------------------------------
-- Helper functions used throughout RLS policies.
-- SECURITY DEFINER + STABLE so Postgres can use them efficiently inside
-- policies without re-evaluating per-row in a way that defeats indexes.
-- ---------------------------------------------------------------------------

-- Is auth.uid() a member of the given workspace at all?
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

-- What role does auth.uid() hold in the given workspace? (null if not a member)
create or replace function public.workspace_role(p_workspace_id uuid)
returns varchar
language sql
security definer
stable
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid();
$$;

-- Role-rank comparison mirroring lib/db/rbac.ts's getRoleRank, used to decide
-- "does auth.uid() have at least role X in this workspace".
create or replace function public.has_min_role(p_workspace_id uuid, p_min_role varchar)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case (select role from public.workspace_members
               where workspace_id = p_workspace_id and user_id = auth.uid())
    when 'owner' then true
    when 'admin' then p_min_role in ('admin', 'member', 'viewer')
    when 'member' then p_min_role in ('member', 'viewer')
    when 'viewer' then p_min_role in ('viewer')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name varchar(255) not null,
    key varchar(16),
    color varchar(32),
    description text not null default '',
    status varchar(32) not null default 'planning'
        check (status in ('planning', 'in_progress', 'review', 'completed', 'on_hold')),
    progress int not null default 0 check (progress >= 0 and progress <= 100),
    budget varchar(64),
    deadline timestamptz,
    lead_id uuid references public.users(id) on delete set null,
    tags text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_projects_tenant on public.projects(workspace_id);
create index if not exists idx_projects_status on public.projects(workspace_id, status);

create table if not exists public.project_members (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (project_id, user_id)
);
create index if not exists idx_pm_project on public.project_members(project_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-touch trigger, reused by every table with an updated_at column
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_touch before update on public.users
  for each row execute function public.touch_updated_at();
create trigger trg_workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- USERS: a user can read their own row, plus the rows of anyone who shares
-- at least one workspace with them (mirrors the co-member logic previously
-- implemented by hand in app/api/auth/session/route.ts).
create policy users_select_self_and_comembers on public.users
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm1
      join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid() and wm2.user_id = public.users.id
    )
  );

create policy users_update_self on public.users
  for update using (id = auth.uid());

-- WORKSPACES: only members can see a workspace.
create policy workspaces_select_member on public.workspaces
  for select using (public.is_workspace_member(id));

create policy workspaces_update_owner_admin on public.workspaces
  for update using (public.has_min_role(id, 'admin'));

create policy workspaces_delete_owner on public.workspaces
  for delete using (public.workspace_role(id) = 'owner');

-- Anyone authenticated may create a workspace (they become its owner via the
-- application transaction that also inserts their membership row).
create policy workspaces_insert_authenticated on public.workspaces
  for insert with check (owner_id = auth.uid());

-- WORKSPACE_MEMBERS: members can see the roster of workspaces they belong to.
create policy wm_select_member on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy wm_insert_owner_admin on public.workspace_members
  for insert with check (
    public.has_min_role(workspace_id, 'admin')
    -- allow the very first membership row (workspace creation) to be
    -- inserted by the creating user for themselves
    or (user_id = auth.uid() and role = 'owner')
  );

create policy wm_update_manage_roles on public.workspace_members
  for update using (
    public.has_min_role(workspace_id, 'admin')
  );

create policy wm_delete_owner_admin on public.workspace_members
  for delete using (public.has_min_role(workspace_id, 'admin'));

-- PROJECTS
create policy projects_select_member on public.projects
  for select using (public.is_workspace_member(workspace_id));

create policy projects_insert_member on public.projects
  for insert with check (public.has_min_role(workspace_id, 'member'));

create policy projects_update_member on public.projects
  for update using (public.has_min_role(workspace_id, 'member'));

create policy projects_delete_admin on public.projects
  for delete using (public.has_min_role(workspace_id, 'admin'));

-- PROJECT_MEMBERS
create policy pm_select_member on public.project_members
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
  );

create policy pm_write_member on public.project_members
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and public.has_min_role(p.workspace_id, 'member'))
  );
