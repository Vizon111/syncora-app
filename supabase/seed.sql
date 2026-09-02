-- =============================================================================
-- Syncora — Demo/dev seed data.
--
-- Inserts the fixed demo identities referenced by lib/db/demo-ids.ts as
-- fallback defaults across the API routes (e.g. `x-user-id` header missing
-- -> falls back to DEMO_USER_ID). Run this after supabase/migrations/ and
-- after supabase/local-test-mocks/0000_mock_supabase_auth.sql if testing
-- against a plain (non-Supabase) local Postgres.
--
-- Safe to re-run: every insert is idempotent via ON CONFLICT DO NOTHING.
-- =============================================================================

-- auth.users row is required first (public.users.id has an FK to it in real
-- Supabase; the local mock in local-test-mocks/ provides the same table).
insert into auth.users (id, email) values
  ('d71c563f-8e8d-4645-9071-c29a4c1d45ec', 'demo@syncora.io')
on conflict (id) do nothing;

insert into public.users (id, email, name, avatar_url, color, status) values
  ('d71c563f-8e8d-4645-9071-c29a4c1d45ec', 'demo@syncora.io', 'Demo User',
   'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
   '#3b82f6', 'online')
on conflict (id) do nothing;

insert into public.workspaces (id, name, slug, owner_id, plan) values
  ('8a4f77ad-2000-42e0-a0c9-4f4d904c5aff', 'Acme Inc', 'acme',
   'd71c563f-8e8d-4645-9071-c29a4c1d45ec', 'pro'),
  ('e1a71b6e-0e89-499a-a460-547c9f3ed8cc', 'Alpha Squad', 'alpha',
   'd71c563f-8e8d-4645-9071-c29a4c1d45ec', 'pro')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role) values
  ('8a4f77ad-2000-42e0-a0c9-4f4d904c5aff', 'd71c563f-8e8d-4645-9071-c29a4c1d45ec', 'owner'),
  ('e1a71b6e-0e89-499a-a460-547c9f3ed8cc', 'd71c563f-8e8d-4645-9071-c29a4c1d45ec', 'owner')
on conflict (workspace_id, user_id) do nothing;

insert into public.projects (id, workspace_id, name, description, status, progress, deadline, lead_id) values
  ('f15826ae-80da-4958-8495-d42f88dfe997', '8a4f77ad-2000-42e0-a0c9-4f4d904c5aff',
   'Flowspace Core', 'Core product workstream', 'in_progress', 35,
   now() + interval '30 days', 'd71c563f-8e8d-4645-9071-c29a4c1d45ec')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id) values
  ('f15826ae-80da-4958-8495-d42f88dfe997', 'd71c563f-8e8d-4645-9071-c29a4c1d45ec')
on conflict (project_id, user_id) do nothing;
