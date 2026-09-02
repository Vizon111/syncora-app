-- =============================================================================
-- Manual RLS smoke test: proves tenant isolation and role enforcement work
-- against the migrated schema, using two workspaces and users of different
-- roles. Run as the unprivileged app role, not postgres superuser (RLS is
-- bypassed for superusers/table owners by default).
-- =============================================================================

-- Create a low-privilege role that behaves like Supabase's "authenticated"
-- role: RLS applies to it, unlike the postgres superuser.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login;
  end if;
end $$;

grant usage on schema public, auth to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant select on auth.users to app_user;
grant execute on function auth.uid to app_user;

-- --- Seed as postgres (RLS bypassed for setup) -------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'viewer_a@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@test.com')
on conflict do nothing;

insert into public.users (id, email, name) values
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'viewer_a@test.com', 'Viewer A'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@test.com', 'Owner B')
on conflict do nothing;

insert into public.workspaces (id, name, slug, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Workspace A', 'workspace-a', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Workspace B', 'workspace-b', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'owner')
on conflict do nothing;

insert into public.projects (id, workspace_id, name, deadline, lead_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Project A1', now(), '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Project B1', now(), '33333333-3333-3333-3333-333333333333')
on conflict do nothing;

\echo '--- TEST 1: owner_a should see only Workspace A ---'
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id, name from public.workspaces order by name;
reset role;

\echo '--- TEST 2: owner_a should see only Project A1, not Project B1 ---'
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id, name from public.projects order by name;
reset role;

\echo '--- TEST 3: owner_b should see only Project B1 ---'
set role app_user;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select id, name from public.projects order by name;
reset role;

\echo '--- TEST 4: viewer_a (role=viewer) CANNOT insert a task (expect ERROR / 0 rows) ---'
set role app_user;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.tasks (workspace_id, project_id, title, due_date, reporter_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Viewer attempted task', now(), '22222222-2222-2222-2222-222222222222');
reset role;

\echo '--- TEST 5: owner_a (role=owner) CAN insert a task ---'
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.tasks (workspace_id, project_id, title, due_date, reporter_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Owner created task', now(), '11111111-1111-1111-1111-111111111111')
returning id, title;
reset role;

\echo '--- TEST 6: owner_b tries to read tasks in Workspace A by forging workspace_id filter (expect 0 rows, proving RLS -- not app-level filtering -- enforces this) ---'
set role app_user;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select id, title from public.tasks where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;

\echo '--- TEST 7: unauthenticated (no JWT sub set) sees nothing ---'
set role app_user;
reset request.jwt.claim.sub;
select count(*) as visible_workspaces_when_anonymous from public.workspaces;
reset role;
