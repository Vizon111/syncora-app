import {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  Sprint,
  RetroItem,
  SprintRetroSummary,
  Task,
  WorklogItem,
  Document,
  DocumentVersion,
  DocumentChunk,
  Comment,
  CommentReply,
  FileItem,
  ActivityLog,
  AiMessage,
  Role,
} from '@/lib/types';

// -----------------------------------------------------------------------------
// Row shapes as they come back from Postgres/PostgREST (snake_case columns).
// Kept intentionally loose (any-ish) on jsonb columns; validated at the edges
// where it matters.
// -----------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  color: string;
  status: 'online' | 'idle' | 'offline';
  last_active_at: string | null;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  users?: UserRow | null; // joined via `users:user_id (*)`
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  owner_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  member_count?: number; // computed separately, not a real column
}

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  key: string | null;
  color: string | null;
  description: string;
  status: string;
  progress: number;
  budget: string | null;
  deadline: string | null;
  lead_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  lead?: UserRow | null;
  project_members?: { user_id: string }[];
}

export interface SprintRow {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  goal: string;
  status: string;
  start_date: string;
  end_date: string;
  duration_weeks: number | null;
  total_story_points: number;
  completed_story_points: number;
  created_at: string;
  updated_at: string;
}

export interface RetroItemRow {
  id: string;
  workspace_id: string;
  sprint_id: string;
  category: string;
  title: string;
  description: string;
  votes: number;
  voted_user_ids: string[];
  author_id: string | null;
  status: string | null;
  converted_task_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: string | null;
  created_at: string;
  author?: UserRow | null;
  assignee?: UserRow | null;
}

export interface SprintRetroSummaryRow {
  workspace_id: string;
  sprint_id: string;
  sprint_name: string;
  health_score: number;
  sentiment: string;
  velocity_analysis: any;
  ai_summary: string;
  top_achievements: string[];
  blockers_identified: string[];
  recommendations: string[];
  kudos: any;
  generated_at: string;
}

export interface WorklogRow {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  description: string;
  logged_at: string;
  user?: UserRow | null;
}

export interface TaskRow {
  id: string;
  workspace_id: string;
  project_id: string;
  sprint_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  story_points: number | null;
  estimated_hours: number | null;
  logged_hours: number;
  completed_at: string | null;
  assignee_id: string | null;
  reporter_id: string | null;
  start_date: string | null;
  due_date: string;
  dependencies: string[];
  progress: number | null;
  milestone: boolean;
  labels: string[];
  comments_count: number;
  task_order: number;
  subtasks: any;
  acceptance_criteria: any;
  created_at: string;
  updated_at: string;
  assignee?: UserRow | null;
  reporter?: UserRow | null;
  task_worklogs?: WorklogRow[];
}

export interface DocumentRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  emoji: string | null;
  raw_text: string;
  content_delta: string | null; // base64 from PostgREST bytea
  version: number;
  is_locked: boolean;
  author_id: string | null;
  last_edited_by_id: string | null;
  created_at: string;
  updated_at: string;
  author?: UserRow | null;
  last_edited_by?: UserRow | null;
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  version: number;
  author_id: string | null;
  title: string;
  snapshot_text: string;
  change_summary: string | null;
  created_at: string;
  author?: UserRow | null;
}

export interface DocumentChunkRow {
  id: string;
  workspace_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  text_content: string;
  embedding: number[] | null;
  token_count: number;
  created_at: string;
}

export interface CommentReplyRow {
  id: string;
  comment_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: UserRow | null;
}

export interface CommentRow {
  id: string;
  workspace_id: string;
  target_type: 'document' | 'task';
  target_id: string;
  author_id: string;
  content: string;
  resolved: boolean;
  resolved_by_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  author?: UserRow | null;
  resolved_by?: UserRow | null;
  comment_replies?: CommentReplyRow[];
}

export interface FileRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  name: string;
  file_size: number;
  mime_type: string;
  storage_path: string | null;
  extracted_text: string | null;
  is_indexed_for_rag: boolean;
  uploaded_by_id: string | null;
  created_at: string;
  uploaded_by?: UserRow | null;
}

export interface ActivityRow {
  id: string;
  workspace_id: string;
  user_id: string;
  user_role: string | null;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  details: string | null;
  metadata: any;
  created_at: string;
  users?: UserRow | null;
}

export interface AiMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: any;
  action_proposal: any;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Mappers: DB row -> application type
// -----------------------------------------------------------------------------

export function mapUser(row: UserRow, role: Role = 'member'): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar_url || '',
    color: row.color,
    role,
    status: row.status,
    lastActiveAt: row.last_active_at || undefined,
  };
}

export function mapWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role,
    joinedAt: row.joined_at,
    user: row.users ? mapUser(row.users, row.role) : ({ id: row.user_id } as User),
  };
}

export function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    avatar: row.avatar || '',
    ownerId: row.owner_id,
    plan: row.plan,
    createdAt: row.created_at,
    membersCount: row.member_count ?? 0,
  };
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    key: row.key || undefined,
    color: row.color || undefined,
    description: row.description,
    status: row.status as Project['status'],
    progress: row.progress,
    budget: row.budget || undefined,
    deadline: row.deadline || '',
    leadId: row.lead_id || '',
    lead: row.lead ? mapUser(row.lead) : ({ id: row.lead_id || '' } as User),
    memberIds: (row.project_members || []).map((m) => m.user_id),
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    goal: row.goal,
    startDate: row.start_date,
    endDate: row.end_date,
    durationWeeks: row.duration_weeks || undefined,
    status: row.status as Sprint['status'],
    totalStoryPoints: row.total_story_points,
    completedStoryPoints: row.completed_story_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRetroItem(row: RetroItemRow): RetroItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sprintId: row.sprint_id,
    category: row.category as RetroItem['category'],
    title: row.title,
    description: row.description,
    votes: row.votes,
    votedUserIds: row.voted_user_ids || [],
    authorId: row.author_id || '',
    authorName: row.author?.name || '',
    authorAvatar: row.author?.avatar_url || '',
    status: (row.status as RetroItem['status']) || undefined,
    convertedTaskId: row.converted_task_id || undefined,
    assigneeId: row.assignee_id || undefined,
    assigneeName: row.assignee?.name || undefined,
    dueDate: row.due_date || undefined,
    priority: (row.priority as RetroItem['priority']) || undefined,
    createdAt: row.created_at,
  };
}

export function mapSprintRetroSummary(row: SprintRetroSummaryRow): SprintRetroSummary {
  return {
    sprintId: row.sprint_id,
    workspaceId: row.workspace_id,
    sprintName: row.sprint_name,
    healthScore: row.health_score,
    sentiment: row.sentiment as SprintRetroSummary['sentiment'],
    velocityAnalysis: row.velocity_analysis,
    aiSummary: row.ai_summary,
    topAchievements: row.top_achievements || [],
    blockersIdentified: row.blockers_identified || [],
    recommendations: row.recommendations || [],
    kudos: row.kudos || [],
    generatedAt: row.generated_at,
  };
}

export function mapWorklog(row: WorklogRow): WorklogItem {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    user: row.user ? mapUser(row.user) : undefined,
    hours: Number(row.hours),
    description: row.description,
    loggedAt: row.logged_at,
  };
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sprintId: row.sprint_id,
    title: row.title,
    description: row.description,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    storyPoints: row.story_points ?? undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    loggedHours: Number(row.logged_hours || 0),
    worklogs: (row.task_worklogs || []).map(mapWorklog),
    completedAt: row.completed_at || undefined,
    assigneeId: row.assignee_id || undefined,
    assignee: row.assignee ? mapUser(row.assignee) : undefined,
    reporterId: row.reporter_id || '',
    reporter: row.reporter ? mapUser(row.reporter) : undefined,
    startDate: row.start_date || undefined,
    dueDate: row.due_date,
    dependencies: row.dependencies || [],
    progress: row.progress ?? undefined,
    milestone: row.milestone,
    labels: row.labels || [],
    commentsCount: row.comments_count,
    order: row.task_order,
    subtasks: row.subtasks || [],
    acceptanceCriteria: row.acceptance_criteria || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentVersion(row: DocumentVersionRow): DocumentVersion {
  return {
    id: row.id,
    version: row.version,
    authorId: row.author_id || '',
    authorName: row.author?.name || '',
    title: row.title,
    snapshot: row.snapshot_text,
    timestamp: row.created_at,
    changeSummary: row.change_summary || undefined,
  };
}

export function mapDocument(row: DocumentRow, versions?: DocumentVersionRow[]): Document {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id || undefined,
    title: row.title,
    emoji: row.emoji || undefined,
    rawText: row.raw_text,
    contentDelta: row.content_delta || undefined,
    version: row.version,
    isLocked: row.is_locked,
    authorId: row.author_id || '',
    author: row.author ? mapUser(row.author) : undefined,
    lastEditedById: row.last_edited_by_id || '',
    lastEditedBy: row.last_edited_by ? mapUser(row.last_edited_by) : undefined,
    versions: versions ? versions.map(mapDocumentVersion) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentChunk(row: DocumentChunkRow): DocumentChunk {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    chunkIndex: row.chunk_index,
    text: row.text_content,
    embedding: row.embedding || undefined,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}

export function mapCommentReply(row: CommentReplyRow): CommentReply {
  return {
    id: row.id,
    commentId: row.comment_id,
    authorId: row.author_id,
    author: row.author ? mapUser(row.author) : ({ id: row.author_id } as User),
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    targetType: row.target_type,
    targetId: row.target_id,
    authorId: row.author_id,
    author: row.author ? mapUser(row.author) : ({ id: row.author_id } as User),
    content: row.content,
    resolved: row.resolved,
    resolvedBy: row.resolved_by?.name || undefined,
    resolvedAt: row.resolved_at || undefined,
    replies: (row.comment_replies || [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(mapCommentReply),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFile(row: FileRow): FileItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id || undefined,
    name: row.name,
    size: row.file_size,
    type: row.mime_type,
    url: row.storage_path || undefined,
    extractedText: row.extracted_text || undefined,
    isIndexedForRag: row.is_indexed_for_rag,
    uploadedById: row.uploaded_by_id || '',
    uploadedBy: row.uploaded_by ? mapUser(row.uploaded_by) : undefined,
    createdAt: row.created_at,
  };
}

export function mapActivity(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    userName: row.users?.name || '',
    userAvatar: row.users?.avatar_url || '',
    userRole: (row.user_role as Role) || undefined,
    action: row.action as ActivityLog['action'],
    targetType: row.target_type as ActivityLog['targetType'],
    targetId: row.target_id,
    targetName: row.target_name,
    details: row.details || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
  };
}

export function mapAiMessage(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: row.citations || undefined,
    actionProposal: row.action_proposal || undefined,
    createdAt: row.created_at,
  };
}
