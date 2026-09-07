-- =============================================================================
-- Syncora — Migration 0010: AI Chat Sessions (Copilot chat history)
--
-- ai_messages (added in 0004) already stores every chat message, but flat —
-- there's no concept of "conversation #1" vs "conversation #2", so the UI
-- has never been able to show a history list or let a user switch between
-- past chats. This adds ai_chat_sessions as the grouping entity and a
-- session_id column on ai_messages to tie messages to one.
--
-- session_id is nullable to avoid breaking any pre-existing ai_messages
-- rows (none are expected in practice, since the chat UI never persisted
-- history before this migration, but nullable is the safe default for an
-- ALTER on a table that might already have rows in some environment).
-- =============================================================================

create table if not exists public.ai_chat_sessions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    title text not null default 'New chat',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_ai_chat_sessions_user
  on public.ai_chat_sessions(workspace_id, user_id, updated_at desc);

create trigger trg_ai_chat_sessions_touch before update on public.ai_chat_sessions
  for each row execute function public.touch_updated_at();

alter table public.ai_messages
  add column if not exists session_id uuid references public.ai_chat_sessions(id) on delete cascade;

create index if not exists idx_ai_messages_session
  on public.ai_messages(session_id, created_at asc);

alter table public.ai_chat_sessions enable row level security;

-- A chat session is private to the user who started it — teammates
-- shouldn't see each other's AI Copilot conversations by default, unlike
-- ai_messages' existing "any workspace member can read" policy. This is a
-- deliberate difference: workspace-wide history was never how this table
-- was actually used (see the comment above), so scoping the new sessions
-- table to the owner avoids a surprising, un-asked-for behavior change.
create policy ai_chat_sessions_select_own on public.ai_chat_sessions
  for select using (user_id = auth.uid());
create policy ai_chat_sessions_insert_own on public.ai_chat_sessions
  for insert with check (user_id = auth.uid());
create policy ai_chat_sessions_update_own on public.ai_chat_sessions
  for update using (user_id = auth.uid());
create policy ai_chat_sessions_delete_own on public.ai_chat_sessions
  for delete using (user_id = auth.uid());
