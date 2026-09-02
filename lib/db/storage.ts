import {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  Sprint,
  Task,
  WorklogItem,
  Document,
  DocumentChunk,
  Comment,
  FileItem,
  ActivityLog,
  AiMessage,
  Role,
  RetroItem,
  SprintRetroSummary,
} from '@/lib/types';
import { hasPermission, Permission } from './rbac';
import { supabaseAdmin } from './supabase-client';
import {
  UserRow,
  WorkspaceRow,
  WorkspaceMemberRow,
  ProjectRow,
  SprintRow,
  RetroItemRow,
  SprintRetroSummaryRow,
  TaskRow,
  DocumentRow,
  DocumentVersionRow,
  DocumentChunkRow,
  CommentRow,
  FileRow,
  ActivityRow,
  AiMessageRow,
  mapUser,
  mapWorkspaceMember,
  mapWorkspace,
  mapProject,
  mapSprint,
  mapRetroItem,
  mapSprintRetroSummary,
  mapWorklog,
  mapTask,
  mapDocument,
  mapDocumentChunk,
  mapComment,
  mapFile,
  mapActivity,
  mapAiMessage,
} from './mappers';

const USER_SELECT = 'id, email, name, avatar_url, color, status, last_active_at';
const MEMBER_WITH_USER_SELECT = `workspace_id, user_id, role, joined_at, users:user_id (${USER_SELECT})`;
const TASK_SELECT = `
  id, workspace_id, project_id, sprint_id, title, description, status, priority,
  story_points, estimated_hours, logged_hours, completed_at, assignee_id, reporter_id,
  start_date, due_date, dependencies, progress, milestone, labels, comments_count,
  task_order, subtasks, acceptance_criteria, created_at, updated_at,
  assignee:assignee_id (${USER_SELECT}),
  reporter:reporter_id (${USER_SELECT}),
  task_worklogs (id, task_id, user_id, hours, description, logged_at, user:user_id (${USER_SELECT}))
`;
const DOCUMENT_SELECT = `
  id, workspace_id, project_id, title, emoji, raw_text, content_delta, version, is_locked,
  author_id, last_edited_by_id, created_at, updated_at,
  author:author_id (${USER_SELECT}),
  last_edited_by:last_edited_by_id (${USER_SELECT})
`;
const COMMENT_SELECT = `
  id, workspace_id, target_type, target_id, author_id, content, resolved, resolved_by_id,
  resolved_at, created_at, updated_at,
  author:author_id (${USER_SELECT}),
  resolved_by:resolved_by_id (${USER_SELECT}),
  comment_replies (id, comment_id, author_id, content, created_at, author:author_id (${USER_SELECT}))
`;
const FILE_SELECT = `
  id, workspace_id, project_id, name, file_size, mime_type, storage_path, extracted_text,
  is_indexed_for_rag, uploaded_by_id, created_at,
  uploaded_by:uploaded_by_id (${USER_SELECT})
`;
const RETRO_SELECT = `
  id, workspace_id, sprint_id, category, title, description, votes, voted_user_ids,
  author_id, status, converted_task_id, assignee_id, due_date, priority, created_at,
  author:author_id (${USER_SELECT}),
  assignee:assignee_id (${USER_SELECT})
`;

class DatabaseStore {
  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------

  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin.from('users').select(USER_SELECT).eq('id', userId).maybeSingle();
    if (error) throw new Error(`[db] getUser: ${error.message}`);
    return data ? mapUser(data as UserRow) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin.from('users').select(USER_SELECT).eq('email', email).maybeSingle();
    if (error) throw new Error(`[db] getUserByEmail: ${error.message}`);
    return data ? mapUser(data as UserRow) : null;
  }

  async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await supabaseAdmin.from('users').select(USER_SELECT).in('id', userIds);
    if (error) throw new Error(`[db] getUsersByIds: ${error.message}`);
    return (data as UserRow[]).map((r) => mapUser(r));
  }

  /** Users who share at least one workspace with `userId` (mirrors the old
   *  co-member logic that lived inline in app/api/auth/session/route.ts). */
  async getCoMemberUsers(userId: string): Promise<User[]> {
    const { data: myMemberships, error: err1 } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);
    if (err1) throw new Error(`[db] getCoMemberUsers (memberships): ${err1.message}`);

    const workspaceIds = (myMemberships || []).map((m: { workspace_id: string }) => m.workspace_id);
    if (workspaceIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .select(MEMBER_WITH_USER_SELECT)
      .in('workspace_id', workspaceIds);
    if (error) throw new Error(`[db] getCoMemberUsers: ${error.message}`);

    const seen = new Map<string, User>();
    for (const row of (data as unknown as WorkspaceMemberRow[]) || []) {
      if (row.users) seen.set(row.user_id, mapUser(row.users, row.role));
    }
    return Array.from(seen.values());
  }

  /**
   * Invites a person by email to join the app, creating a real
   * `auth.users` row via Supabase Admin Auth (they'll receive an email to
   * set a password / confirm), which in turn triggers the automatic
   * `public.users` profile creation defined in
   * supabase/migrations/0005_auth_user_sync.sql.
   *
   * This is NOT the same as the old in-memory createUser(), which only
   * wrote to a Map. It must go through Supabase Auth now, because
   * public.users.id has a foreign key to auth.users(id) (see
   * supabase/migrations/0001_core.sql) — inserting a public.users row for
   * an id that doesn't exist in auth.users would violate that constraint
   * and fail (or, if the constraint were ever relaxed, silently create an
   * account nobody could sign into).
   */
  async inviteUserByEmail(email: string, name?: string): Promise<User> {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: name ? { name } : undefined,
    });
    if (error) throw new Error(`[db] inviteUserByEmail: ${error.message}`);

    // The 0005 trigger fires synchronously within the same transaction that
    // creates the auth.users row, so the public.users profile should exist
    // by the time this returns. Fetch it to get the fully-formed profile
    // (color, defaults, etc) rather than constructing one by hand here.
    const profile = await this.getUser(data.user.id);
    if (!profile) {
      throw new Error(`[db] inviteUserByEmail: auth user created but public.users profile is missing (id=${data.user.id})`);
    }
    return profile;
  }

  async userExists(userId: string): Promise<boolean> {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('id', userId);
    if (error) throw new Error(`[db] userExists: ${error.message}`);
    return (count || 0) > 0;
  }

  // ---------------------------------------------------------------------
  // Workspaces & Members
  // ---------------------------------------------------------------------

  /** Workspaces `userId` is a member of. */
  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .select('workspaces (id, name, slug, avatar, owner_id, plan, created_at)')
      .eq('user_id', userId);
    if (error) throw new Error(`[db] getWorkspacesForUser: ${error.message}`);

    const workspaces = ((data as unknown as { workspaces: WorkspaceRow }[]) || [])
      .map((r) => r.workspaces)
      .filter(Boolean);

    return Promise.all(workspaces.map((ws) => this.hydrateWorkspaceMemberCount(ws)));
  }

  async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, slug, avatar, owner_id, plan, created_at')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getWorkspaceById: ${error.message}`);
    if (!data) return null;
    return this.hydrateWorkspaceMemberCount(data as WorkspaceRow);
  }

  private async hydrateWorkspaceMemberCount(row: WorkspaceRow): Promise<Workspace> {
    const { count, error } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', row.id);
    if (error) throw new Error(`[db] hydrateWorkspaceMemberCount: ${error.message}`);
    return mapWorkspace({ ...row, member_count: count || 0 });
  }

  async getWorkspaceUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .select(MEMBER_WITH_USER_SELECT)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`[db] getWorkspaceUser: ${error.message}`);
    return data ? mapWorkspaceMember(data as unknown as WorkspaceMemberRow) : null;
  }

  /** All members of a workspace, with their user profiles joined in — used
   *  for AI workload analysis, team pickers, etc. that previously did
   *  `Array.from(db.users.values())` and assumed that was "everyone". */
  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .select(MEMBER_WITH_USER_SELECT)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] getWorkspaceMembers: ${error.message}`);
    return (data as unknown as WorkspaceMemberRow[]).map(mapWorkspaceMember);
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const { count, error } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw new Error(`[db] isWorkspaceMember: ${error.message}`);
    return (count || 0) > 0;
  }

  /**
   * Server-side RBAC validation helper. Behaves identically to the original
   * in-memory implementation: this is what every mutating route calls before
   * touching data, and remains the enforcement point (rather than Postgres
   * RLS) even now that the server authenticates via a verified Supabase Auth
   * session (see lib/supabase/server.ts) instead of a trusted client header —
   * see lib/db/supabase-client.ts for why RLS is kept as a backstop rather
   * than the primary mechanism.
   */
  async authorize(
    workspaceId: string,
    userId: string,
    requiredPermission: Permission
  ): Promise<{ authorized: boolean; member?: WorkspaceMember; error?: string }> {
    const member = await this.getWorkspaceUser(workspaceId, userId);
    if (!member) {
      return { authorized: false, error: 'User is not a member of this workspace (Tenant Isolation Enforced).' };
    }
    if (!hasPermission(member.role, requiredPermission)) {
      return { authorized: false, member, error: `Role '${member.role}' lacks permission '${requiredPermission}'.` };
    }
    return { authorized: true, member };
  }

  async createWorkspace(workspace: Workspace, ownerRole: Role = 'owner'): Promise<Workspace> {
    const { error: wsError } = await supabaseAdmin.from('workspaces').insert({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      avatar: workspace.avatar,
      owner_id: workspace.ownerId,
      plan: workspace.plan,
    });
    if (wsError) throw new Error(`[db] createWorkspace: ${wsError.message}`);

    const { error: memberError } = await supabaseAdmin.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: workspace.ownerId,
      role: ownerRole,
    });
    if (memberError) throw new Error(`[db] createWorkspace (owner membership): ${memberError.message}`);

    return workspace;
  }

  async addWorkspaceMember(workspaceId: string, userId: string, role: Role): Promise<WorkspaceMember> {
    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .upsert({ workspace_id: workspaceId, user_id: userId, role }, { onConflict: 'workspace_id,user_id' })
      .select(MEMBER_WITH_USER_SELECT)
      .single();
    if (error) throw new Error(`[db] addWorkspaceMember: ${error.message}`);
    return mapWorkspaceMember(data as unknown as WorkspaceMemberRow);
  }

  async incrementWorkspaceMemberCount(_workspaceId: string): Promise<void> {
    // membersCount is now computed live from workspace_members in
    // hydrateWorkspaceMemberCount(); nothing to persist separately.
    return;
  }

  // ---------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------

  private readonly PROJECT_SELECT = `
    id, workspace_id, name, key, color, description, status, progress, budget, deadline, lead_id, tags,
    created_at, updated_at,
    lead:lead_id (${USER_SELECT}),
    project_members (user_id)
  `;

  async getProjects(workspaceId: string): Promise<Project[]> {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(this.PROJECT_SELECT)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] getProjects: ${error.message}`);
    return (data as unknown as ProjectRow[]).map(mapProject);
  }

  async getProjectById(projectId: string, workspaceId?: string): Promise<Project | null> {
    let query = supabaseAdmin.from('projects').select(this.PROJECT_SELECT).eq('id', projectId);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`[db] getProjectById: ${error.message}`);
    return data ? mapProject(data as unknown as ProjectRow) : null;
  }

  async createProject(project: Project): Promise<Project> {
    const { error } = await supabaseAdmin.from('projects').insert({
      id: project.id,
      workspace_id: project.workspaceId,
      name: project.name,
      key: project.key,
      color: project.color,
      description: project.description,
      status: project.status,
      progress: project.progress,
      budget: project.budget,
      deadline: project.deadline,
      lead_id: project.leadId,
      tags: project.tags,
    });
    if (error) throw new Error(`[db] createProject: ${error.message}`);

    if (project.memberIds.length > 0) {
      const { error: pmError } = await supabaseAdmin
        .from('project_members')
        .insert(project.memberIds.map((userId) => ({ project_id: project.id, user_id: userId })));
      if (pmError) throw new Error(`[db] createProject (members): ${pmError.message}`);
    }

    return project;
  }

  async updateProject(project: Project): Promise<Project> {
    const { error } = await supabaseAdmin
      .from('projects')
      .update({
        name: project.name,
        key: project.key,
        color: project.color,
        description: project.description,
        status: project.status,
        progress: project.progress,
        budget: project.budget,
        deadline: project.deadline,
        lead_id: project.leadId,
        tags: project.tags,
      })
      .eq('id', project.id)
      .eq('workspace_id', project.workspaceId);
    if (error) throw new Error(`[db] updateProject: ${error.message}`);
    return project;
  }

  // ---------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------

  async getTasks(workspaceId: string, projectId?: string): Promise<Task[]> {
    let query = supabaseAdmin.from('tasks').select(TASK_SELECT).eq('workspace_id', workspaceId);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query.order('task_order', { ascending: true });
    if (error) throw new Error(`[db] getTasks: ${error.message}`);
    return (data as unknown as TaskRow[]).map(mapTask);
  }

  async getTaskById(taskId: string, workspaceId: string): Promise<Task | null> {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', taskId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getTaskById: ${error.message}`);
    return data ? mapTask(data as unknown as TaskRow) : null;
  }

  async createTask(task: Task, actor: User): Promise<Task> {
    const { error } = await supabaseAdmin.from('tasks').insert({
      id: task.id,
      workspace_id: task.workspaceId,
      project_id: task.projectId,
      sprint_id: task.sprintId || null,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      story_points: task.storyPoints,
      estimated_hours: task.estimatedHours,
      logged_hours: task.loggedHours || 0,
      assignee_id: task.assigneeId,
      reporter_id: task.reporterId,
      start_date: task.startDate,
      due_date: task.dueDate,
      dependencies: task.dependencies || [],
      progress: task.progress,
      milestone: task.milestone || false,
      labels: task.labels,
      task_order: task.order,
      subtasks: task.subtasks || [],
      acceptance_criteria: task.acceptanceCriteria || [],
    });
    if (error) throw new Error(`[db] createTask: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: task.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'created_task',
      targetType: 'task',
      targetId: task.id,
      targetName: task.title,
      details: `Created task in column ${task.status.toUpperCase()} (${task.priority} priority)`,
      createdAt: new Date().toISOString(),
    });
    return task;
  }

  async updateTask(task: Task, actor: User): Promise<Task> {
    const old = await this.getTaskById(task.id, task.workspaceId);

    const { error } = await supabaseAdmin
      .from('tasks')
      .update({
        project_id: task.projectId,
        sprint_id: task.sprintId || null,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        story_points: task.storyPoints,
        estimated_hours: task.estimatedHours,
        completed_at: task.status === 'done' ? task.completedAt || new Date().toISOString() : null,
        assignee_id: task.assigneeId || null,
        reporter_id: task.reporterId,
        start_date: task.startDate,
        due_date: task.dueDate,
        dependencies: task.dependencies || [],
        progress: task.progress,
        milestone: task.milestone || false,
        labels: task.labels,
        task_order: task.order,
        subtasks: task.subtasks || [],
        acceptance_criteria: task.acceptanceCriteria || [],
      })
      .eq('id', task.id)
      .eq('workspace_id', task.workspaceId);
    if (error) throw new Error(`[db] updateTask: ${error.message}`);

    let details = 'Updated task details';
    if (old && old.status !== task.status) {
      details = `Moved from ${old.status.toUpperCase()} to ${task.status.toUpperCase()}`;
    }

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: task.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: task.id,
      targetName: task.title,
      details,
      createdAt: new Date().toISOString(),
    });
    return task;
  }

  async deleteTask(taskId: string, workspaceId: string, actor: User): Promise<boolean> {
    const task = await this.getTaskById(taskId, workspaceId);
    if (!task) return false;

    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', taskId).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] deleteTask: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: taskId,
      targetName: task.title,
      details: 'Deleted task',
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  // ---------------------------------------------------------------------
  // Sprints
  // ---------------------------------------------------------------------

  async getSprints(workspaceId: string, projectId?: string): Promise<Sprint[]> {
    let query = supabaseAdmin
      .from('sprints')
      .select(
        'id, workspace_id, project_id, name, goal, status, start_date, end_date, duration_weeks, total_story_points, completed_story_points, created_at, updated_at'
      )
      .eq('workspace_id', workspaceId);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw new Error(`[db] getSprints: ${error.message}`);

    const sprints = (data as SprintRow[]).map(mapSprint);

    // Recompute dynamic story point totals from current tasks, same as the
    // original in-memory implementation did on every read.
    const tasks = await this.getTasks(workspaceId, projectId);
    return sprints.map((sprint) => {
      const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
      const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const completedSP = sprintTasks.filter((t) => t.status === 'done').reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      return {
        ...sprint,
        totalStoryPoints: totalSP || sprint.totalStoryPoints || 0,
        completedStoryPoints: completedSP || (sprint.status === 'completed' ? sprint.completedStoryPoints || totalSP : 0),
      };
    });
  }

  async getSprintById(sprintId: string, workspaceId: string): Promise<Sprint | null> {
    const { data, error } = await supabaseAdmin
      .from('sprints')
      .select(
        'id, workspace_id, project_id, name, goal, status, start_date, end_date, duration_weeks, total_story_points, completed_story_points, created_at, updated_at'
      )
      .eq('id', sprintId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getSprintById: ${error.message}`);
    return data ? mapSprint(data as SprintRow) : null;
  }

  async createSprint(sprint: Sprint, actor: User): Promise<Sprint> {
    const { error } = await supabaseAdmin.from('sprints').insert({
      id: sprint.id,
      workspace_id: sprint.workspaceId,
      project_id: sprint.projectId,
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      start_date: sprint.startDate,
      end_date: sprint.endDate,
      duration_weeks: sprint.durationWeeks,
      total_story_points: sprint.totalStoryPoints || 0,
      completed_story_points: sprint.completedStoryPoints || 0,
    });
    if (error) throw new Error(`[db] createSprint: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: sprint.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'created_task',
      targetType: 'task',
      targetId: sprint.id,
      targetName: sprint.name,
      details: `Created new sprint: "${sprint.name}" with goal: ${sprint.goal}`,
      createdAt: new Date().toISOString(),
    });
    return sprint;
  }

  async updateSprint(sprint: Sprint, actor: User): Promise<Sprint> {
    const { error } = await supabaseAdmin
      .from('sprints')
      .update({
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        start_date: sprint.startDate,
        end_date: sprint.endDate,
        duration_weeks: sprint.durationWeeks,
        total_story_points: sprint.totalStoryPoints,
        completed_story_points: sprint.completedStoryPoints,
      })
      .eq('id', sprint.id)
      .eq('workspace_id', sprint.workspaceId);
    if (error) throw new Error(`[db] updateSprint: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: sprint.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: sprint.id,
      targetName: sprint.name,
      details: `Updated sprint configuration (${sprint.status.toUpperCase()})`,
      createdAt: new Date().toISOString(),
    });
    return sprint;
  }

  async deleteSprint(sprintId: string, workspaceId: string, actor: User): Promise<boolean> {
    const sprint = await this.getSprintById(sprintId, workspaceId);
    if (!sprint) return false;

    // Move associated tasks back to the Product Backlog before deleting the
    // sprint (ON DELETE SET NULL on tasks.sprint_id would also achieve this
    // at the DB level, but we do it explicitly to also bump updated_at and
    // keep this logic visible/testable at the application layer).
    const { error: taskError } = await supabaseAdmin
      .from('tasks')
      .update({ sprint_id: null })
      .eq('workspace_id', workspaceId)
      .eq('sprint_id', sprintId);
    if (taskError) throw new Error(`[db] deleteSprint (unassign tasks): ${taskError.message}`);

    const { error } = await supabaseAdmin.from('sprints').delete().eq('id', sprintId).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] deleteSprint: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: sprintId,
      targetName: sprint.name,
      details: `Deleted sprint and moved tasks to Backlog`,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async startSprint(sprintId: string, workspaceId: string, actor: User): Promise<Sprint | null> {
    const sprint = await this.getSprintById(sprintId, workspaceId);
    if (!sprint) return null;

    const { error } = await supabaseAdmin
      .from('sprints')
      .update({ status: 'active' })
      .eq('id', sprintId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] startSprint: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: sprintId,
      targetName: sprint.name,
      details: `Started active sprint: ${sprint.name}`,
      createdAt: new Date().toISOString(),
    });
    return { ...sprint, status: 'active' };
  }

  async completeSprint(sprintId: string, workspaceId: string, actor: User): Promise<Sprint | null> {
    const sprint = await this.getSprintById(sprintId, workspaceId);
    if (!sprint) return null;

    const sprintTasks = await this.getTasks(workspaceId);
    const tasksInSprint = sprintTasks.filter((t) => t.sprintId === sprintId);
    const completedSP = tasksInSprint.filter((t) => t.status === 'done').reduce((acc, t) => acc + (t.storyPoints || 0), 0);
    const totalSP = tasksInSprint.reduce((acc, t) => acc + (t.storyPoints || 0), 0);

    const { error } = await supabaseAdmin
      .from('sprints')
      .update({ status: 'completed', completed_story_points: completedSP, total_story_points: totalSP })
      .eq('id', sprintId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] completeSprint: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: sprintId,
      targetName: sprint.name,
      details: `Completed sprint with ${completedSP}/${totalSP} Story Points delivered!`,
      createdAt: new Date().toISOString(),
    });
    return { ...sprint, status: 'completed', completedStoryPoints: completedSP, totalStoryPoints: totalSP };
  }

  // ---------------------------------------------------------------------
  // Retrospective items
  // ---------------------------------------------------------------------

  async getRetroItems(workspaceId: string, sprintId?: string): Promise<RetroItem[]> {
    let query = supabaseAdmin.from('retro_items').select(RETRO_SELECT).eq('workspace_id', workspaceId);
    if (sprintId) query = query.eq('sprint_id', sprintId);
    const { data, error } = await query;
    if (error) throw new Error(`[db] getRetroItems: ${error.message}`);

    const items = (data as unknown as RetroItemRow[]).map(mapRetroItem);
    return items.sort((a, b) => (b.votes || 0) - (a.votes || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRetroItemById(itemId: string, workspaceId: string): Promise<RetroItem | null> {
    const { data, error } = await supabaseAdmin
      .from('retro_items')
      .select(RETRO_SELECT)
      .eq('id', itemId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getRetroItemById: ${error.message}`);
    return data ? mapRetroItem(data as unknown as RetroItemRow) : null;
  }

  async createRetroItem(item: RetroItem, actor: User): Promise<RetroItem> {
    const { error } = await supabaseAdmin.from('retro_items').insert({
      id: item.id,
      workspace_id: item.workspaceId,
      sprint_id: item.sprintId,
      category: item.category,
      title: item.title,
      description: item.description,
      votes: item.votes || 0,
      voted_user_ids: item.votedUserIds || [],
      author_id: item.authorId,
      status: item.status,
      assignee_id: item.assigneeId,
      due_date: item.dueDate,
      priority: item.priority,
    });
    if (error) throw new Error(`[db] createRetroItem: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: item.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'created_task',
      targetType: 'task',
      targetId: item.id,
      targetName: item.title,
      details: `Added retrospective card: [${item.category.toUpperCase()}] "${item.title}"`,
      createdAt: new Date().toISOString(),
    });
    return item;
  }

  async updateRetroItem(item: RetroItem, _actor: User): Promise<RetroItem> {
    const { error } = await supabaseAdmin
      .from('retro_items')
      .update({
        category: item.category,
        title: item.title,
        description: item.description,
        status: item.status,
        assignee_id: item.assigneeId,
        due_date: item.dueDate,
        priority: item.priority,
      })
      .eq('id', item.id)
      .eq('workspace_id', item.workspaceId);
    if (error) throw new Error(`[db] updateRetroItem: ${error.message}`);
    return item;
  }

  async voteRetroItem(itemId: string, userId: string, workspaceId: string): Promise<RetroItem | null> {
    const item = await this.getRetroItemById(itemId, workspaceId);
    if (!item) return null;

    const voted = item.votedUserIds || [];
    const hasVoted = voted.includes(userId);
    const newVotedIds = hasVoted ? voted.filter((id) => id !== userId) : [...voted, userId];
    const newVotes = hasVoted ? Math.max(0, (item.votes || 1) - 1) : (item.votes || 0) + 1;

    const { error } = await supabaseAdmin
      .from('retro_items')
      .update({ voted_user_ids: newVotedIds, votes: newVotes })
      .eq('id', itemId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] voteRetroItem: ${error.message}`);

    return { ...item, votedUserIds: newVotedIds, votes: newVotes };
  }

  async deleteRetroItem(itemId: string, workspaceId: string, _actor: User): Promise<boolean> {
    const item = await this.getRetroItemById(itemId, workspaceId);
    if (!item) return false;
    const { error } = await supabaseAdmin.from('retro_items').delete().eq('id', itemId).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] deleteRetroItem: ${error.message}`);
    return true;
  }

  async convertRetroActionToTask(
    itemId: string,
    workspaceId: string,
    targetSprintId: string | null,
    actor: User
  ): Promise<{ task: Task; retroItem: RetroItem } | null> {
    const item = await this.getRetroItemById(itemId, workspaceId);
    if (!item) return null;

    const sprint = targetSprintId ? await this.getSprintById(targetSprintId, workspaceId) : null;
    const projects = await this.getProjects(workspaceId);
    const projectId = sprint?.projectId || projects[0]?.id;
    if (!projectId) throw new Error('[db] convertRetroActionToTask: no project available in workspace');

    const assignee = item.assigneeId ? await this.getUser(item.assigneeId) : null;

    const newTask: Task = {
      id: crypto.randomUUID(),
      workspaceId,
      projectId,
      sprintId: targetSprintId,
      title: item.title,
      description: `[Создано из Ретроспективы Спринта]: ${item.description}\n\nАвтор идеи: ${item.authorName} (Голосов: ${item.votes})`,
      status: 'todo',
      priority: item.priority || 'high',
      storyPoints: 3,
      estimatedHours: 8,
      loggedHours: 0,
      worklogs: [],
      assigneeId: item.assigneeId || actor.id,
      assignee: assignee || actor,
      reporterId: actor.id,
      reporter: actor,
      dueDate: item.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      labels: ['Retro Action', 'Agile', 'Improvement'],
      commentsCount: 0,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.createTask(newTask, actor);

    const { error } = await supabaseAdmin
      .from('retro_items')
      .update({ status: 'converted_to_task', converted_task_id: newTask.id })
      .eq('id', item.id)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] convertRetroActionToTask (update retro): ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'created_task',
      targetType: 'task',
      targetId: newTask.id,
      targetName: newTask.title,
      details: `Converted Retro Action Item into actionable task ${targetSprintId ? `in sprint "${sprint?.name}"` : 'in Product Backlog'}`,
      createdAt: new Date().toISOString(),
    });

    return { task: newTask, retroItem: { ...item, status: 'converted_to_task', convertedTaskId: newTask.id } };
  }

  async getSprintRetroSummary(workspaceId: string, sprintId: string): Promise<SprintRetroSummary | null> {
    const { data, error } = await supabaseAdmin
      .from('sprint_retro_summaries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sprint_id', sprintId)
      .maybeSingle();
    if (error) throw new Error(`[db] getSprintRetroSummary: ${error.message}`);
    return data ? mapSprintRetroSummary(data as SprintRetroSummaryRow) : null;
  }

  async saveSprintRetroSummary(summary: SprintRetroSummary, _actor: User): Promise<SprintRetroSummary> {
    const { error } = await supabaseAdmin.from('sprint_retro_summaries').upsert(
      {
        workspace_id: summary.workspaceId,
        sprint_id: summary.sprintId,
        sprint_name: summary.sprintName,
        health_score: summary.healthScore,
        sentiment: summary.sentiment,
        velocity_analysis: summary.velocityAnalysis,
        ai_summary: summary.aiSummary,
        top_achievements: summary.topAchievements,
        blockers_identified: summary.blockersIdentified,
        recommendations: summary.recommendations,
        kudos: summary.kudos,
        generated_at: summary.generatedAt,
      },
      { onConflict: 'workspace_id,sprint_id' }
    );
    if (error) throw new Error(`[db] saveSprintRetroSummary: ${error.message}`);
    return summary;
  }

  // ---------------------------------------------------------------------
  // Worklogs
  // ---------------------------------------------------------------------

  async logWorkTime(
    taskId: string,
    workspaceId: string,
    worklog: Omit<WorklogItem, 'id' | 'loggedAt' | 'user'>,
    actor: User
  ): Promise<{ task: Task; worklog: WorklogItem } | null> {
    const task = await this.getTaskById(taskId, workspaceId);
    if (!task) return null;

    const { data, error } = await supabaseAdmin
      .from('task_worklogs')
      .insert({
        task_id: taskId,
        workspace_id: workspaceId,
        user_id: actor.id,
        hours: Number(worklog.hours),
        description: worklog.description || 'General task development & implementation',
      })
      .select(`id, task_id, user_id, hours, description, logged_at, user:user_id (${USER_SELECT})`)
      .single();
    if (error) throw new Error(`[db] logWorkTime: ${error.message}`);

    const newLog = mapWorklog(data as any);

    const { data: sumRow, error: sumError } = await supabaseAdmin
      .from('task_worklogs')
      .select('hours')
      .eq('task_id', taskId);
    if (sumError) throw new Error(`[db] logWorkTime (sum): ${sumError.message}`);
    const totalHours = Number(((sumRow || []).reduce((sum: number, r: { hours: number }) => sum + Number(r.hours || 0), 0)).toFixed(2));

    const { error: taskError } = await supabaseAdmin
      .from('tasks')
      .update({ logged_hours: totalHours })
      .eq('id', taskId)
      .eq('workspace_id', workspaceId);
    if (taskError) throw new Error(`[db] logWorkTime (update task): ${taskError.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'updated_task_status',
      targetType: 'task',
      targetId: task.id,
      targetName: task.title,
      details: `Logged ${newLog.hours}h: "${newLog.description}" (Total: ${totalHours}h / ${task.estimatedHours || 0}h)`,
      createdAt: new Date().toISOString(),
    });

    const updatedTask = await this.getTaskById(taskId, workspaceId);
    return { task: updatedTask!, worklog: newLog };
  }

  async deleteWorklog(taskId: string, worklogId: string, workspaceId: string, _actor: User): Promise<Task | null> {
    const task = await this.getTaskById(taskId, workspaceId);
    if (!task) return null;

    const { error } = await supabaseAdmin.from('task_worklogs').delete().eq('id', worklogId).eq('task_id', taskId);
    if (error) throw new Error(`[db] deleteWorklog: ${error.message}`);

    const { data: sumRow, error: sumError } = await supabaseAdmin
      .from('task_worklogs')
      .select('hours')
      .eq('task_id', taskId);
    if (sumError) throw new Error(`[db] deleteWorklog (sum): ${sumError.message}`);
    const totalHours = Number(((sumRow || []).reduce((sum: number, r: { hours: number }) => sum + Number(r.hours || 0), 0)).toFixed(2));

    const { error: taskError } = await supabaseAdmin
      .from('tasks')
      .update({ logged_hours: totalHours })
      .eq('id', taskId)
      .eq('workspace_id', workspaceId);
    if (taskError) throw new Error(`[db] deleteWorklog (update task): ${taskError.message}`);

    return this.getTaskById(taskId, workspaceId);
  }

  // ---------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------

  async getDocuments(workspaceId: string): Promise<Document[]> {
    const { data, error } = await supabaseAdmin.from('documents').select(DOCUMENT_SELECT).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] getDocuments: ${error.message}`);
    return (data as unknown as DocumentRow[]).map((r) => mapDocument(r));
  }

  async getDocumentById(docId: string, workspaceId: string): Promise<Document | null> {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', docId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getDocumentById: ${error.message}`);
    if (!data) return null;

    const { data: versions, error: vError } = await supabaseAdmin
      .from('document_versions')
      .select(`id, document_id, version, author_id, title, snapshot_text, change_summary, created_at, author:author_id (${USER_SELECT})`)
      .eq('document_id', docId)
      .order('version', { ascending: false });
    if (vError) throw new Error(`[db] getDocumentById (versions): ${vError.message}`);

    return mapDocument(data as unknown as DocumentRow, versions as unknown as DocumentVersionRow[]);
  }

  async createDocument(doc: Document, actor: User): Promise<Document> {
    const { error } = await supabaseAdmin.from('documents').insert({
      id: doc.id,
      workspace_id: doc.workspaceId,
      project_id: doc.projectId,
      title: doc.title,
      emoji: doc.emoji,
      raw_text: doc.rawText,
      content_delta: doc.contentDelta,
      version: doc.version || 1,
      is_locked: doc.isLocked || false,
      author_id: doc.authorId,
      last_edited_by_id: doc.lastEditedById || doc.authorId,
    });
    if (error) throw new Error(`[db] createDocument: ${error.message}`);

    await this.indexWorkspaceDocuments(doc.workspaceId);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: doc.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'created_document',
      targetType: 'document',
      targetId: doc.id,
      targetName: doc.title,
      details: 'Created new collaborative document',
      createdAt: new Date().toISOString(),
    });
    return doc;
  }

  async updateDocument(doc: Document, actor: User, changeSummary?: string): Promise<Document> {
    const existing = await this.getDocumentById(doc.id, doc.workspaceId);
    const version = (existing?.version || 1) + 1;

    const { error } = await supabaseAdmin
      .from('documents')
      .update({
        title: doc.title,
        emoji: doc.emoji,
        raw_text: doc.rawText,
        content_delta: doc.contentDelta,
        version,
        is_locked: doc.isLocked,
        project_id: doc.projectId,
        last_edited_by_id: actor.id,
      })
      .eq('id', doc.id)
      .eq('workspace_id', doc.workspaceId);
    if (error) throw new Error(`[db] updateDocument: ${error.message}`);

    const { error: vError } = await supabaseAdmin.from('document_versions').insert({
      document_id: doc.id,
      workspace_id: doc.workspaceId,
      version,
      author_id: actor.id,
      title: doc.title,
      snapshot_text: doc.rawText,
      change_summary: changeSummary || 'Real-time collaborative CRDT update',
    });
    if (vError) throw new Error(`[db] updateDocument (version): ${vError.message}`);

    await this.indexWorkspaceDocuments(doc.workspaceId);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: doc.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'edited_document',
      targetType: 'document',
      targetId: doc.id,
      targetName: doc.title,
      details: changeSummary || `Saved version v${version}`,
      createdAt: new Date().toISOString(),
    });

    return { ...doc, version, lastEditedById: actor.id, lastEditedBy: actor, updatedAt: new Date().toISOString() };
  }

  async deleteDocument(docId: string, workspaceId: string, _actor: User): Promise<boolean> {
    const doc = await this.getDocumentById(docId, workspaceId);
    if (!doc) return false;

    const { error } = await supabaseAdmin.from('documents').delete().eq('id', docId).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] deleteDocument: ${error.message}`);

    await this.indexWorkspaceDocuments(workspaceId);
    return true;
  }

  // ---------------------------------------------------------------------
  // RAG indexing & document chunks
  // ---------------------------------------------------------------------

  /**
   * Chunks all documents & files in the workspace into search tokens.
   *
   * NOTE: this preserves the original lexical (non-vector) chunking scheme
   * verbatim — it does not populate the `embedding` column added in
   * supabase/migrations/0003. Wiring real Gemini embeddings into this
   * pipeline (and switching lib/ai/rag-engine.ts over to pgvector cosine
   * search) is meaningful follow-up work, tracked separately from the
   * storage-layer migration so as not to change RAG *behavior* while
   * changing where the data lives.
   */
  async indexWorkspaceDocuments(workspaceId: string): Promise<void> {
    const docs = await this.getDocuments(workspaceId);
    const files = await this.getFiles(workspaceId);

    const { error: delError } = await supabaseAdmin.from('document_chunks').delete().eq('workspace_id', workspaceId);
    if (delError) throw new Error(`[db] indexWorkspaceDocuments (clear): ${delError.message}`);

    const CHUNK_SIZE = 400;
    const OVERLAP = 50;
    const chunkRows: Record<string, unknown>[] = [];

    const chunkText = (text: string, documentId: string, documentTitle: string) => {
      const words = text.split(/\s+/).filter(Boolean);
      let index = 0;
      for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
        const slice = words.slice(i, i + CHUNK_SIZE).join(' ');
        if (!slice.trim()) continue;
        chunkRows.push({
          workspace_id: workspaceId,
          document_id: documentId,
          document_title: documentTitle,
          chunk_index: index,
          text_content: slice,
          token_count: slice.split(/\s+/).length,
        });
        index += 1;
        if (i + CHUNK_SIZE >= words.length) break;
      }
    };

    for (const doc of docs) {
      chunkText(doc.rawText, doc.id, doc.title);
    }
    for (const file of files) {
      if (file.isIndexedForRag && file.extractedText) {
        chunkText(file.extractedText, file.id, `File: ${file.name}`);
      }
    }

    if (chunkRows.length > 0) {
      const { error } = await supabaseAdmin.from('document_chunks').insert(chunkRows);
      if (error) throw new Error(`[db] indexWorkspaceDocuments (insert): ${error.message}`);
    }
  }

  async getDocumentChunks(workspaceId: string): Promise<DocumentChunk[]> {
    const { data, error } = await supabaseAdmin.from('document_chunks').select('*').eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] getDocumentChunks: ${error.message}`);
    return (data as DocumentChunkRow[]).map(mapDocumentChunk);
  }

  // ---------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------

  async getComments(workspaceId: string, targetType?: string, targetId?: string): Promise<Comment[]> {
    let query = supabaseAdmin.from('comments').select(COMMENT_SELECT).eq('workspace_id', workspaceId);
    if (targetType) query = query.eq('target_type', targetType);
    if (targetId) query = query.eq('target_id', targetId);
    const { data, error } = await query;
    if (error) throw new Error(`[db] getComments: ${error.message}`);
    return (data as unknown as CommentRow[]).map(mapComment);
  }

  async addComment(comment: Comment, actor: User): Promise<Comment> {
    const { error } = await supabaseAdmin.from('comments').insert({
      id: comment.id,
      workspace_id: comment.workspaceId,
      target_type: comment.targetType,
      target_id: comment.targetId,
      author_id: comment.authorId,
      content: comment.content,
      resolved: comment.resolved || false,
    });
    if (error) throw new Error(`[db] addComment: ${error.message}`);

    if (comment.targetType === 'task') {
      const { data: taskRow, error: taskFetchError } = await supabaseAdmin
        .from('tasks')
        .select('comments_count')
        .eq('id', comment.targetId)
        .maybeSingle();
      if (taskFetchError) throw new Error(`[db] addComment (fetch task): ${taskFetchError.message}`);
      if (taskRow) {
        const { error: taskUpdateError } = await supabaseAdmin
          .from('tasks')
          .update({ comments_count: (taskRow.comments_count || 0) + 1 })
          .eq('id', comment.targetId);
        if (taskUpdateError) throw new Error(`[db] addComment (update task count): ${taskUpdateError.message}`);
      }
    }

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: comment.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'added_comment',
      targetType: comment.targetType,
      targetId: comment.targetId,
      targetName: `Comment on ${comment.targetType}`,
      details: comment.content.slice(0, 80) + (comment.content.length > 80 ? '...' : ''),
      createdAt: new Date().toISOString(),
    });
    return comment;
  }

  async getCommentById(commentId: string, workspaceId: string): Promise<Comment | null> {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('id', commentId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`[db] getCommentById: ${error.message}`);
    return data ? mapComment(data as unknown as CommentRow) : null;
  }

  async addCommentReply(
    commentId: string,
    workspaceId: string,
    reply: { content: string },
    actor: User
  ): Promise<Comment | null> {
    const existing = await this.getCommentById(commentId, workspaceId);
    if (!existing) return null;

    const { error } = await supabaseAdmin.from('comment_replies').insert({
      comment_id: commentId,
      workspace_id: workspaceId,
      author_id: actor.id,
      content: reply.content,
    });
    if (error) throw new Error(`[db] addCommentReply: ${error.message}`);

    // touch the parent comment's updated_at so it sorts/refreshes correctly
    const { error: touchError } = await supabaseAdmin
      .from('comments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('workspace_id', workspaceId);
    if (touchError) throw new Error(`[db] addCommentReply (touch): ${touchError.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'added_comment',
      targetType: existing.targetType,
      targetId: existing.targetId,
      targetName: `Reply on ${existing.targetType} comment thread`,
      details: reply.content.slice(0, 80) + (reply.content.length > 80 ? '...' : ''),
      createdAt: new Date().toISOString(),
    });

    return this.getCommentById(commentId, workspaceId);
  }

  async resolveComment(commentId: string, workspaceId: string, actor: User, resolved: boolean): Promise<Comment | null> {
    const c = await this.getCommentById(commentId, workspaceId);
    if (!c) return null;

    const { error } = await supabaseAdmin
      .from('comments')
      .update({
        resolved,
        resolved_by_id: resolved ? actor.id : null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq('id', commentId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] resolveComment: ${error.message}`);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'resolved_comment',
      targetType: c.targetType,
      targetId: c.targetId,
      targetName: `Comment thread on ${c.targetType}`,
      details: resolved ? 'Marked thread as resolved' : 'Reopened comment thread',
      createdAt: new Date().toISOString(),
    });

    return {
      ...c,
      resolved,
      resolvedBy: resolved ? actor.name : undefined,
      resolvedAt: resolved ? new Date().toISOString() : undefined,
    };
  }

  // ---------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------

  async getFiles(workspaceId: string): Promise<FileItem[]> {
    const { data, error } = await supabaseAdmin.from('files').select(FILE_SELECT).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] getFiles: ${error.message}`);
    return (data as unknown as FileRow[]).map(mapFile);
  }

  async addFile(file: FileItem, actor: User): Promise<FileItem> {
    const { error } = await supabaseAdmin.from('files').insert({
      id: file.id,
      workspace_id: file.workspaceId,
      project_id: file.projectId,
      name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: file.url,
      extracted_text: file.extractedText,
      is_indexed_for_rag: file.isIndexedForRag,
      uploaded_by_id: file.uploadedById,
    });
    if (error) throw new Error(`[db] addFile: ${error.message}`);

    await this.indexWorkspaceDocuments(file.workspaceId);

    await this.logActivity({
      id: crypto.randomUUID(),
      workspaceId: file.workspaceId,
      userId: actor.id,
      userName: actor.name,
      userAvatar: actor.avatar,
      userRole: actor.role,
      action: 'uploaded_file',
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
      details: `Uploaded ${file.name} (${Math.round(file.size / 1024)} KB) and indexed for RAG`,
      createdAt: new Date().toISOString(),
    });
    return file;
  }

  async deleteFile(fileId: string, workspaceId: string, _actor: User): Promise<boolean> {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('files')
      .select('id')
      .eq('id', fileId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (fetchError) throw new Error(`[db] deleteFile (fetch): ${fetchError.message}`);
    if (!existing) return false;

    const { error } = await supabaseAdmin.from('files').delete().eq('id', fileId).eq('workspace_id', workspaceId);
    if (error) throw new Error(`[db] deleteFile: ${error.message}`);

    await this.indexWorkspaceDocuments(workspaceId);
    return true;
  }

  // ---------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------

  async getActivities(workspaceId: string, limit = 50): Promise<ActivityLog[]> {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select(`id, workspace_id, user_id, user_role, action, target_type, target_id, target_name, details, metadata, created_at, users:user_id (${USER_SELECT})`)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`[db] getActivities: ${error.message}`);
    return (data as unknown as ActivityRow[]).map(mapActivity);
  }

  async logActivity(activity: ActivityLog): Promise<void> {
    const { error } = await supabaseAdmin.from('activities').insert({
      id: activity.id,
      workspace_id: activity.workspaceId,
      user_id: activity.userId,
      user_role: activity.userRole,
      action: activity.action,
      target_type: activity.targetType,
      target_id: activity.targetId,
      target_name: activity.targetName,
      details: activity.details,
      metadata: activity.metadata || {},
    });
    if (error) throw new Error(`[db] logActivity: ${error.message}`);
  }

  // ---------------------------------------------------------------------
  // AI messages
  // ---------------------------------------------------------------------

  async getAiMessages(workspaceId: string): Promise<AiMessage[]> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .select('id, role, content, citations, action_proposal, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`[db] getAiMessages: ${error.message}`);
    return (data as AiMessageRow[]).map(mapAiMessage);
  }

  async addAiMessage(workspaceId: string, userId: string | null, message: AiMessage): Promise<AiMessage> {
    const { error } = await supabaseAdmin.from('ai_messages').insert({
      id: message.id,
      workspace_id: workspaceId,
      user_id: userId,
      role: message.role,
      content: message.content,
      citations: message.citations || [],
      action_proposal: message.actionProposal || null,
    });
    if (error) throw new Error(`[db] addAiMessage: ${error.message}`);
    return message;
  }

  // ---------------------------------------------------------------------
  // AI rate limiting (delegates to the atomic check_ai_rate_limit RPC
  // defined in supabase/migrations/0004 — see lib/ai/rate-limit.ts for the
  // thin wrapper routes actually call)
  // ---------------------------------------------------------------------

  async checkAiRateLimit(key: string, maxPerMinute: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const { data, error } = await supabaseAdmin.rpc('check_ai_rate_limit', { p_key: key, p_max_per_minute: maxPerMinute });
    if (error) throw new Error(`[db] checkAiRateLimit: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds ?? undefined };
  }
}

// Global Singleton for Container Runtime — kept for parity with the previous
// module (Next.js dev mode hot-reloads modules; this avoids re-instantiating
// the Supabase client wrapper on every request in development).
const globalForDb = global as unknown as { dbStore?: DatabaseStore };
export const db = globalForDb.dbStore || new DatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForDb.dbStore = db;
