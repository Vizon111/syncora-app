export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  role: Role;
  status?: 'online' | 'idle' | 'offline';
  lastActiveAt?: string;
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: Role;
  joinedAt: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatar: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  membersCount: number;
}

export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key?: string;
  color?: string;
  description: string;
  status: ProjectStatus;
  progress: number; // 0 to 100
  budget?: string;
  deadline: string;
  leadId: string;
  lead: User;
  memberIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface WorklogItem {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  hours: number;
  description: string;
  loggedAt: string;
}

export type SprintStatus = 'draft' | 'active' | 'completed';

export interface Sprint {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  durationWeeks?: number;
  status: SprintStatus;
  totalStoryPoints?: number;
  completedStoryPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export type RetroCategory = 'went_well' | 'to_improve' | 'insight' | 'action_item' | 'kudos';
export type RetroItemStatus = 'pending' | 'in_progress' | 'completed' | 'converted_to_task';

export interface RetroItem {
  id: string;
  workspaceId: string;
  sprintId: string;
  category: RetroCategory;
  title: string;
  description: string;
  votes: number;
  votedUserIds: string[];
  authorId: string;
  authorName: string;
  authorAvatar: string;
  status?: RetroItemStatus;
  convertedTaskId?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  priority?: TaskPriority;
  createdAt: string;
}

export interface SprintRetroSummary {
  sprintId: string;
  workspaceId: string;
  sprintName: string;
  healthScore: number;
  sentiment: 'excellent' | 'good' | 'mixed' | 'needs_attention';
  velocityAnalysis: {
    committedSP: number;
    completedSP: number;
    velocityVariancePct: number;
    averageCycleTimeDays: number;
    completionRatePct: number;
  };
  aiSummary: string;
  topAchievements: string[];
  blockersIdentified: string[];
  recommendations: string[];
  kudos: { to: string; from: string; reason: string }[];
  generatedAt: string;
}

export interface SprintHealthDiagnosis {
  healthScore: number;
  healthLevel: 'healthy' | 'at_risk' | 'critical';
  projectedCompletionPct: number;
  summary: string;
  risks: { factor: string; impact: 'high' | 'medium' | 'low'; mitigation: string }[];
  bottlenecks: { title: string; assignee?: string; reason: string }[];
  workloadDistribution: {
    userId: string;
    userName: string;
    userAvatar: string;
    assignedSP: number;
    capacitySP: number;
    status: 'optimal' | 'overloaded' | 'underutilized';
  }[];
  keyStrengths: string[];
  recommendations: string[];
}

export interface SprintPlanRecommendation {
  recommendedScopeSP: number;
  suggestedSprintGoal: string;
  recommendedTaskIds: string[];
  rationale: string;
  capacityWarning?: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  sprintId?: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  storyPoints?: number;
  estimatedHours?: number;
  loggedHours?: number;
  worklogs?: WorklogItem[];
  completedAt?: string;
  assigneeId?: string;
  assignee?: User;
  reporterId: string;
  reporter?: User;
  startDate?: string;
  dueDate: string;
  dependencies?: string[];
  progress?: number;
  milestone?: boolean;
  labels: string[];
  commentsCount: number;
  order: number;
  subtasks?: { id: string; title: string; completed: boolean }[];
  acceptanceCriteria?: { id: string; text: string; satisfied: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  authorId: string;
  authorName: string;
  title: string;
  snapshot: string;
  timestamp: string;
  changeSummary?: string;
}

export interface Document {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  emoji?: string;
  rawText: string;
  contentDelta?: string; // Serialized Yjs update / binary base64
  version: number;
  isLocked?: boolean;
  authorId: string;
  author?: User;
  lastEditedById: string;
  lastEditedBy?: User;
  versions?: DocumentVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  workspaceId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  tokenCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  workspaceId: string;
  targetType: 'document' | 'task';
  targetId: string;
  authorId: string;
  author: User;
  content: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentReply {
  id: string;
  commentId: string;
  authorId: string;
  author: User;
  content: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  extractedText?: string;
  isIndexedForRag: boolean;
  uploadedById: string;
  uploadedBy?: User;
  createdAt: string;
}

export type ActivityAction =
  | 'user_joined'
  | 'created_task'
  | 'updated_task_status'
  | 'assigned_task'
  | 'created_document'
  | 'edited_document'
  | 'uploaded_file'
  | 'added_comment'
  | 'resolved_comment'
  | 'ai_action_executed';

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole?: Role;
  action: ActivityAction;
  targetType: 'task' | 'document' | 'file' | 'comment' | 'workspace' | 'project';
  targetId: string;
  targetName: string;
  details?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AiCitation {
  id: string;
  sourceType: 'document' | 'task' | 'file' | 'project';
  sourceId: string;
  sourceTitle: string;
  snippet: string;
  score: number;
}

export interface AiActionProposal {
  id: string;
  type: 'create_task' | 'update_task_status' | 'create_document' | 'extract_action_items';
  title: string;
  description: string;
  payload: Record<string, any>;
  isDestructive: boolean;
  status: 'pending' | 'confirmed' | 'rejected' | 'executed';
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: AiCitation[];
  actionProposal?: AiActionProposal;
  timestamp?: string;
  createdAt?: string;
}

export interface RealtimePresenceUser {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  role: Role;
  currentLocation: {
    view: string;
    targetId?: string;
  };
  cursor?: {
    x: number;
    y: number;
    docIndex?: number;
  };
  selection?: {
    from: number;
    to: number;
  };
  lastPing: number;
}

export type RealtimeEventType =
  | 'presence:update'
  | 'presence:leave'
  | 'crdt:sync_step1'
  | 'crdt:sync_step2'
  | 'crdt:update'
  | 'crdt:cursor'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'sprint:created'
  | 'sprint:updated'
  | 'sprint:deleted'
  | 'retro:created'
  | 'retro:updated'
  | 'retro:deleted'
  | 'doc:created'
  | 'doc:updated'
  | 'comment:created'
  | 'comment:resolved'
  | 'activity:logged';

export interface RealtimeEvent {
  id: string;
  workspaceId: string;
  type: RealtimeEventType;
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}

export interface RemoteCursor {
  userId: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  x: number;
  y: number;
  selection?: { start: number; end: number };
  lastUpdated: number;
}

export interface SearchResult {
  id: string;
  type: 'project' | 'task' | 'document' | 'file' | 'comment';
  title: string;
  subtitle: string;
  snippet?: string;
  relevance: number;
  url: string;
  metadata?: Record<string, any>;
}

export type NotificationType = 'assignment' | 'deadline' | 'mention' | 'comment' | 'sprint' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType?: 'task' | 'document' | 'sprint' | 'project';
  targetId?: string;
  view?: string;
  read: boolean;
  createdAt: string;
  urgent?: boolean;
}

// -----------------------------------------------------------------------------
// Client Portal — a public, no-login-required read-only view of one project's
// progress, shared via an unguessable token. See supabase/migrations/0008 and
// app/api/portal/[token]/route.ts for what's exposed and why.
// -----------------------------------------------------------------------------

export interface ProjectPortalLink {
  id: string;
  projectId: string;
  workspaceId: string;
  token: string;
  isEnabled: boolean;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

/** A task as shown to a client on the public portal — deliberately reduced
 *  to only what's safe to share. No description, no assignee identity, no
 *  comments, no internal labels/estimates. */
export interface PortalTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  milestone: boolean;
}

/** A file as shown to a client on the public portal — metadata only; the
 *  actual bytes are fetched through a separate signed-URL request scoped to
 *  this same portal token, never a direct Storage path. */
export interface PortalFileSummary {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}

/** The full payload returned by GET /api/portal/[token] — everything the
 *  public portal page needs to render, and nothing more. */
export interface PortalData {
  projectName: string;
  projectDescription: string;
  progress: number;
  status: ProjectStatus;
  deadline: string;
  tasks: PortalTaskSummary[];
  files: PortalFileSummary[];
  workspaceName: string;
}

