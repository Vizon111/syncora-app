-- =============================================================================
-- Syncora — Migration 0002: Sprints, retrospectives, tasks, worklogs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SPRINTS
-- ---------------------------------------------------------------------------
create table if not exists public.sprints (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    name varchar(255) not null,
    goal text not null default '',
    status varchar(32) not null default 'draft' check (status in ('draft', 'active', 'completed')),
    start_date timestamptz not null,
    end_date timestamptz not null,
    duration_weeks int,
    total_story_points int not null default 0,
    completed_story_points int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_sprints_tenant_proj on public.sprints(workspace_id, project_id);
create index if not exists idx_sprints_status on public.sprints(workspace_id, status);

-- ---------------------------------------------------------------------------
-- RETROSPECTIVE ITEMS
-- (Present in lib/types.ts / storage.ts but missing from the original
-- schema.ts draft — added here.)
-- ---------------------------------------------------------------------------
create table if not exists public.retro_items (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    sprint_id uuid not null references public.sprints(id) on delete cascade,
    category varchar(32) not null check (category in ('went_well', 'to_improve', 'insight', 'action_item', 'kudos')),
    title varchar(500) not null,
    description text not null default '',
    votes int not null default 0,
    voted_user_ids uuid[] not null default '{}',
    author_id uuid references public.users(id) on delete set null,
    status varchar(32) check (status in ('pending', 'in_progress', 'completed', 'converted_to_task')),
    converted_task_id uuid,
    assignee_id uuid references public.users(id) on delete set null,
    due_date date,
    priority varchar(32) check (priority in ('low', 'medium', 'high', 'urgent')),
    created_at timestamptz not null default now()
);
create index if not exists idx_retro_tenant_sprint on public.retro_items(workspace_id, sprint_id);

create table if not exists public.sprint_retro_summaries (
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    sprint_id uuid not null references public.sprints(id) on delete cascade,
    sprint_name varchar(255) not null,
    health_score int not null,
    sentiment varchar(32) not null check (sentiment in ('excellent', 'good', 'mixed', 'needs_attention')),
    velocity_analysis jsonb not null default '{}',
    ai_summary text not null default '',
    top_achievements text[] not null default '{}',
    blockers_identified text[] not null default '{}',
    recommendations text[] not null default '{}',
    kudos jsonb not null default '[]',
    generated_at timestamptz not null default now(),
    primary key (workspace_id, sprint_id)
);

-- ---------------------------------------------------------------------------
-- TASKS
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    sprint_id uuid references public.sprints(id) on delete set null,
    title varchar(500) not null,
    description text not null default '',
    status varchar(32) not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
    priority varchar(32) not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    story_points int,
    estimated_hours numeric(6, 2),
    logged_hours numeric(6, 2) not null default 0,
    completed_at timestamptz,
    assignee_id uuid references public.users(id) on delete set null,
    reporter_id uuid references public.users(id) on delete set null,
    start_date timestamptz,
    due_date timestamptz not null,
    dependencies uuid[] not null default '{}',
    progress int,
    milestone boolean not null default false,
    labels text[] not null default '{}',
    comments_count int not null default 0,
    task_order int not null default 0,
    subtasks jsonb not null default '[]',
    acceptance_criteria jsonb not null default '[]',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_tenant_project on public.tasks(workspace_id, project_id);
create index if not exists idx_tasks_sprint on public.tasks(sprint_id);
create index if not exists idx_tasks_status_order on public.tasks(workspace_id, status, task_order);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);

alter table public.retro_items
  add constraint fk_retro_converted_task foreign key (converted_task_id) references public.tasks(id) on delete set null;

-- ---------------------------------------------------------------------------
-- TASK WORKLOGS (time tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.task_worklogs (
    id uuid primary key default uuid_generate_v4(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    hours numeric(6, 2) not null,
    description text not null default '',
    logged_at timestamptz not null default now()
);
create index if not exists idx_worklogs_task on public.task_worklogs(task_id);

create trigger trg_sprints_touch before update on public.sprints
  for each row execute function public.touch_updated_at();
create trigger trg_tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sprints enable row level security;
alter table public.retro_items enable row level security;
alter table public.sprint_retro_summaries enable row level security;
alter table public.tasks enable row level security;
alter table public.task_worklogs enable row level security;

create policy sprints_select_member on public.sprints
  for select using (public.is_workspace_member(workspace_id));
create policy sprints_insert_member on public.sprints
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy sprints_update_member on public.sprints
  for update using (public.has_min_role(workspace_id, 'member'));
create policy sprints_delete_admin on public.sprints
  for delete using (public.has_min_role(workspace_id, 'admin'));

create policy retro_select_member on public.retro_items
  for select using (public.is_workspace_member(workspace_id));
create policy retro_insert_member on public.retro_items
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy retro_update_member on public.retro_items
  for update using (public.has_min_role(workspace_id, 'member'));
create policy retro_delete_member on public.retro_items
  for delete using (public.has_min_role(workspace_id, 'member'));

create policy retro_summary_select_member on public.sprint_retro_summaries
  for select using (public.is_workspace_member(workspace_id));
create policy retro_summary_write_member on public.sprint_retro_summaries
  for all using (public.has_min_role(workspace_id, 'member'));

create policy tasks_select_member on public.tasks
  for select using (public.is_workspace_member(workspace_id));
create policy tasks_insert_member on public.tasks
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy tasks_update_member on public.tasks
  for update using (public.has_min_role(workspace_id, 'member'));
create policy tasks_delete_member on public.tasks
  for delete using (public.has_min_role(workspace_id, 'member'));

create policy worklogs_select_member on public.task_worklogs
  for select using (public.is_workspace_member(workspace_id));
create policy worklogs_insert_member on public.task_worklogs
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy worklogs_delete_member on public.task_worklogs
  for delete using (public.has_min_role(workspace_id, 'member'));
