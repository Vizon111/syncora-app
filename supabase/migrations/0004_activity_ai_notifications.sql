-- =============================================================================
-- Syncora — Migration 0004: Activity log, AI messages, notifications, rate limiting
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ACTIVITY LOG (realtime audit feed)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    user_role varchar(32),
    action varchar(64) not null,
    target_type varchar(32) not null,
    target_id uuid not null,
    target_name varchar(500) not null,
    details text,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);
create index if not exists idx_activity_tenant on public.activities(workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI CONVERSATIONS & MESSAGES
-- storage.ts keys aiMessages purely by workspaceId (a single running
-- transcript per workspace), so we mirror that instead of introducing a
-- conversation-per-thread model the app doesn't have yet.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    role varchar(32) not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    citations jsonb not null default '[]',
    action_proposal jsonb,
    created_at timestamptz not null default now()
);
create index if not exists idx_ai_messages_ws on public.ai_messages(workspace_id, created_at asc);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- Typed in lib/types.ts (AppNotification) but not yet backed by storage.ts —
-- added now so the UI has somewhere real to read/write once wired up.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    type varchar(32) not null check (type in ('assignment', 'deadline', 'mention', 'comment', 'sprint', 'system')),
    title varchar(500) not null,
    message text not null,
    target_type varchar(32) check (target_type in ('task', 'document', 'sprint', 'project')),
    target_id uuid,
    view varchar(64),
    read boolean not null default false,
    urgent boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- ---------------------------------------------------------------------------
-- AI RATE LIMITING
-- Replaces the in-memory Map in lib/ai/rate-limit.ts with a durable,
-- multi-instance-safe table. A fixed-window counter, same semantics as the
-- original: N requests per rolling 60s window per key (user id).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_rate_limit_buckets (
    key text primary key,
    count int not null default 0,
    window_start timestamptz not null default now()
);

-- Atomically check-and-increment a rate limit bucket. Returns whether the
-- request is allowed and, if not, seconds until the window resets. Runs as
-- a single statement server-side (via RPC) so concurrent requests from the
-- same user across multiple server instances can't race past the limit.
create or replace function public.check_ai_rate_limit(p_key text, p_max_per_minute int)
returns table(allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_bucket record;
begin
  loop
    select * into v_bucket from public.ai_rate_limit_buckets where key = p_key for update;

    if not found then
      insert into public.ai_rate_limit_buckets (key, count, window_start)
      values (p_key, 1, v_now);
      return query select true, null::int;
      return;
    end if;

    if v_now - v_bucket.window_start >= interval '60 seconds' then
      update public.ai_rate_limit_buckets
        set count = 1, window_start = v_now
        where key = p_key;
      return query select true, null::int;
      return;
    end if;

    if v_bucket.count >= p_max_per_minute then
      return query select false, ceil(extract(epoch from (v_bucket.window_start + interval '60 seconds' - v_now)))::int;
      return;
    end if;

    update public.ai_rate_limit_buckets
      set count = count + 1
      where key = p_key;
    return query select true, null::int;
    return;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;
alter table public.ai_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_rate_limit_buckets enable row level security;

create policy activities_select_member on public.activities
  for select using (public.is_workspace_member(workspace_id));
-- Activities are written exclusively by trusted server-side code paths
-- (via service role, or SECURITY DEFINER RPCs) as a side effect of mutations,
-- never directly by a client insert — so there is no insert policy here for
-- the anon/authenticated roles.

create policy ai_messages_select_member on public.ai_messages
  for select using (public.is_workspace_member(workspace_id));
create policy ai_messages_insert_member on public.ai_messages
  for insert with check (public.has_min_role(workspace_id, 'viewer') and role = 'user' and user_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid());

-- Rate limit bucket rows are internal bookkeeping; no client-facing policy
-- grants access. Only the SECURITY DEFINER function above touches this table.
