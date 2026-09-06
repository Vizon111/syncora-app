'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Workspace,
  Project,
  Sprint,
  Task,
  WorklogItem,
  Document,
  FileItem,
  Comment,
  ActivityLog,
  RealtimePresenceUser,
  RealtimeEvent,
  RetroItem,
  SprintRetroSummary,
  SprintHealthDiagnosis,
  SprintPlanRecommendation,
} from '@/lib/types';
import { TRANSLATIONS, Language, Translations } from '@/lib/i18n';

interface WorkspaceContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  currentUser: User;
  allUsers: User[];
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  projects: Project[];
  sprints: Sprint[];
  activeSprint: Sprint | null;
  tasks: Task[];
  documents: Document[];
  files: FileItem[];
  comments: Comment[];
  activities: ActivityLog[];
  onlineUsers: RealtimePresenceUser[];
  connectionStatus: 'connected' | 'reconnecting' | 'offline';
  isLoading: boolean;
  activeView: string;
  setActiveView: (view: string) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { name?: string; avatarUrl?: string }) => Promise<User | null>;
  updateProjectHourlyRate: (projectId: string, hourlyRate: number | null) => Promise<boolean>;
  createTask: (task: Partial<Task>) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<Task | null>;
  deleteTask: (taskId: string) => Promise<boolean>;
  createSprint: (sprint: Partial<Sprint>) => Promise<Sprint | null>;
  updateSprint: (sprint: Sprint) => Promise<Sprint | null>;
  deleteSprint: (sprintId: string) => Promise<boolean>;
  startSprint: (sprintId: string) => Promise<Sprint | null>;
  completeSprint: (sprintId: string) => Promise<Sprint | null>;
  fetchRetroItems: (sprintId: string) => Promise<{ items: RetroItem[]; summary: SprintRetroSummary | null }>;
  createRetroItem: (sprintId: string, item: Partial<RetroItem>) => Promise<RetroItem | null>;
  voteRetroItem: (sprintId: string, itemId: string) => Promise<RetroItem | null>;
  deleteRetroItem: (sprintId: string, itemId: string) => Promise<boolean>;
  convertRetroActionToTask: (sprintId: string, itemId: string, targetSprintId?: string | null) => Promise<{ task: Task; retroItem: RetroItem } | null>;
  generateAiRetrospective: (sprintId: string, focusArea?: string, saveAsDocument?: boolean) => Promise<{ summary: SprintRetroSummary; items: RetroItem[]; document?: Document; markdownReport?: string } | null>;
  generateAiSprintHealth: (sprintId: string) => Promise<SprintHealthDiagnosis | null>;
  generateAiSprintPlan: (sprintId: string) => Promise<SprintPlanRecommendation | null>;
  logTaskWorkTime: (taskId: string, hours: number, description: string) => Promise<Task | null>;
  deleteTaskWorklog: (taskId: string, worklogId: string) => Promise<Task | null>;
  createDocument: (doc: Partial<Document>) => Promise<Document | null>;
  updateDocument: (doc: Document, summary?: string) => Promise<Document | null>;
  deleteDocument: (docId: string) => Promise<boolean>;
  addComment: (targetType: 'document' | 'task', targetId: string, content: string) => Promise<Comment | null>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  uploadFile: (file: Partial<FileItem>) => Promise<FileItem | null>;
  deleteFile: (fileId: string) => Promise<boolean>;
  broadcastEvent: (type: string, payload: any) => void;
  refreshData: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('flowspace_lang') as Language;
        if (saved === 'en' || saved === 'ru' || saved === 'es') return saved;
      } catch {}

      // Auto-detect user browser / system locale
      try {
        const browserLangs = navigator.languages && navigator.languages.length > 0 
          ? navigator.languages 
          : [navigator.language || (navigator as any).userLanguage || ''];

        for (const rawLang of browserLangs) {
          if (!rawLang) continue;
          const code = rawLang.toLowerCase();
          if (code.startsWith('ru') || code.startsWith('be') || code.startsWith('uk') || code.startsWith('kk')) {
            return 'ru';
          }
          if (code.startsWith('es')) {
            return 'es';
          }
          if (code.startsWith('en')) {
            return 'en';
          }
        }
      } catch {}
    }
    // Default fallback is English
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('flowspace_lang', lang);
    } catch {}
  }, []);

  const t = TRANSLATIONS[language];

  // These start null and are populated from GET /api/auth/session, which
  // now resolves the real signed-in user via the Supabase session cookie
  // (see app/api/auth/session/route.ts) rather than a hardcoded prototype
  // placeholder. AppShell (and everything under it) only renders once
  // isLoading is false, so currentUser/currentWorkspace are guaranteed
  // non-null by the time consumers read them — see the loading gate in
  // app/page.tsx.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<RealtimePresenceUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');
  const [isLoading, setIsLoading] = useState(true);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>('doc_prd_core');

  const activeSprint = sprints.find((s) => s.status === 'active') || null;

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Load initial workspace state
  // Loads the signed-in user's identity and their workspace list. Called
  // once on mount (see the effect below) — this no longer needs a
  // currentWorkspace to already be selected, unlike the old single-shot
  // refreshData, since the user's identity is now resolved from their
  // Supabase session rather than assumed.
  const loadSession = useCallback(async () => {
    try {
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json());
      if (!sessionRes.user) {
        // Session expired or invalid — middleware normally catches this
        // before we get here, but if it happens client-side mid-session,
        // send the person back to sign in.
        window.location.href = '/login';
        return;
      }
      setCurrentUser(sessionRes.user);
      if (sessionRes.allUsers) setAllUsers(sessionRes.allUsers);

      const wsRes = await fetch('/api/workspaces').then((r) => r.json());
      const fetchedWorkspaces: Workspace[] = wsRes.workspaces || [];
      setWorkspaces(fetchedWorkspaces);

      if (fetchedWorkspaces.length > 0) {
        setCurrentWorkspace((prev) => prev || fetchedWorkspaces[0]);
        setNeedsWorkspace(false);
      } else {
        // Signed in but not a member of any workspace yet — show the
        // create-workspace screen instead of leaving currentWorkspace null
        // (which previously rendered an infinite "Loading your workspace…"
        // spinner with no way out).
        setNeedsWorkspace(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setIsLoading(false);
    }
  }, []);

  // Loads everything scoped to currentWorkspace once it's known.
  // Depends only on the workspace id (not the whole object) so this
  // callback's identity stays stable across re-renders that update
  // `currentWorkspace` with a new object reference but the same id —
  // otherwise the effect below that calls refreshData() on identity
  // change would refetch (and produce new object references) in a loop.
  const currentWorkspaceId = currentWorkspace?.id ?? null;
  const refreshData = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const [wsRes, prjRes, sprRes, taskRes, docRes, fileRes, cmtRes, actRes] = await Promise.all([
        fetch('/api/workspaces').then((r) => r.json()),
        fetch(`/api/projects?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/sprints?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/tasks?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/documents?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/files?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/comments?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
        fetch(`/api/activity?workspaceId=${currentWorkspaceId}`).then((r) => r.json()),
      ]);

      if (wsRes.workspaces) setWorkspaces(wsRes.workspaces);
      if (prjRes.projects) setProjects(prjRes.projects);
      if (sprRes.sprints) setSprints(sprRes.sprints);
      if (taskRes.tasks) setTasks(taskRes.tasks);
      if (docRes.documents) setDocuments(docRes.documents);
      if (fileRes.files) setFiles(fileRes.files);
      if (cmtRes.comments) setComments(cmtRes.comments);
      if (actRes.activities) setActivities(actRes.activities);

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching workspace data:', err);
      setIsLoading(false);
    }
  }, [currentWorkspaceId]);

  const signOut = useCallback(async () => {
    const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; avatarUrl?: string }) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update profile');
      }
      const { user } = await res.json();
      setCurrentUser(user);
      return user as User;
    } catch (e) {
      console.error('[updateProfile]', e);
      return null;
    }
  }, []);

  const updateProjectHourlyRate = useCallback(
    async (projectId: string, hourlyRate: number | null) => {
      try {
        const res = await fetch('/api/projects/hourly-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, workspaceId: currentWorkspace?.id, hourlyRate }),
        });
        if (!res.ok) throw new Error('Failed to update hourly rate');
        const { project } = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? project : p)));
        return true;
      } catch (e) {
        console.error('[updateProjectHourlyRate]', e);
        return false;
      }
    },
    [currentWorkspace]
  );

  // Handle incoming real-time events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (!event || !event.type) return;

    if (event.type === 'presence:update') {
      if (Array.isArray(event.payload)) {
        setOnlineUsers(event.payload);
      }
    } else if (event.type === 'task:created') {
      setTasks((prev) => {
        if (prev.some((t) => t.id === event.payload.id)) return prev;
        return [event.payload, ...prev];
      });
    } else if (event.type === 'task:updated') {
      setTasks((prev) => prev.map((t) => (t.id === event.payload.id ? event.payload : t)));
    } else if (event.type === 'task:deleted') {
      setTasks((prev) => prev.filter((t) => t.id !== event.payload.taskId));
    } else if (event.type === 'sprint:created') {
      setSprints((prev) => {
        if (prev.some((s) => s.id === event.payload.id)) return prev;
        return [event.payload, ...prev];
      });
    } else if (event.type === 'sprint:updated') {
      setSprints((prev) => prev.map((s) => (s.id === event.payload.id ? event.payload : s)));
    } else if (event.type === 'sprint:deleted') {
      setSprints((prev) => prev.filter((s) => s.id !== event.payload.sprintId));
    } else if (event.type === 'comment:created') {
      setComments((prev) => {
        const exists = prev.some((c) => c.id === event.payload.id);
        if (exists) {
          return prev.map((c) => (c.id === event.payload.id ? event.payload : c));
        }
        return [event.payload, ...prev];
      });
    } else if (event.type === 'comment:resolved') {
      setComments((prev) => prev.map((c) => (c.id === event.payload.id ? event.payload : c)));
    } else if (event.type === 'activity:logged') {
      refreshData();
    }
  }, [refreshData]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) {
        await loadSession();
      }
    };
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        await refreshData();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, refreshData]);

  // Real-time EventSource & BroadcastChannel Setup
  useEffect(() => {
    // Nothing to connect until we know who's signed in and which workspace
    // they're viewing — both are resolved asynchronously from the Supabase
    // session (see loadSession above) rather than assumed at mount.
    if (!currentUser || !currentWorkspace) return;
    // Captured once per effect run so the TS narrowing above holds inside
    // the closures below (setInterval, EventSource handlers) even though
    // the state variables themselves are nullable.
    const user = currentUser;
    const workspace = currentWorkspace;

    // 1. BroadcastChannel for same-origin multi-tab instant sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`flowspace_${workspace.id}`);
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        handleRealtimeEvent(event.data);
      };
    } catch {
      // BroadcastChannel not available in iframe sandbox
    }

    // 2. Server-Sent Events (SSE) Stream
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      try {
        eventSource = new EventSource(`/api/realtime/stream?workspaceId=${workspace.id}`);

        eventSource.onopen = () => {
          setConnectionStatus('connected');
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleRealtimeEvent(data);
          } catch {
            // Ignore non-json pings
          }
        };

        eventSource.onerror = () => {
          setConnectionStatus('reconnecting');
          eventSource?.close();
          reconnectTimeout = setTimeout(connectSSE, 4000);
        };
      } catch {
        setConnectionStatus('offline');
      }
    }

    connectSSE();

    // 3. Presence Heartbeat
    const presencePing = setInterval(() => {
      const presencePayload: RealtimePresenceUser = {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
        role: user.role,
        currentLocation: {
          view: activeView,
          targetId: activeView === 'documents' ? selectedDocId || undefined : undefined,
        },
        lastPing: Date.now(),
      };

      fetch('/api/realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          type: 'presence:update',
          senderId: user.id,
          senderName: user.name,
          timestamp: Date.now(),
          payload: presencePayload,
        }),
      }).catch(() => {});
    }, 15000);

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(presencePing);
      bc?.close();
    };
  }, [currentWorkspace, currentUser, activeView, selectedDocId, handleRealtimeEvent]);

  const broadcastEvent = (type: string, payload: any) => {
    const event: RealtimeEvent = {
      id: `evt_${Date.now()}`,
      workspaceId: currentWorkspace!.id,
      type: type as any,
      senderId: currentUser!.id,
      senderName: currentUser!.name,
      timestamp: Date.now(),
      payload,
    };

    // Instant local BroadcastChannel emit
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage(event);
    }

    // Network broadcast
    fetch('/api/realtime/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {});
  };

  const switchWorkspace = async (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      setIsLoading(true);
    }
  };

  // Task Actions
  const createTask = async (taskData: Partial<Task>): Promise<Task | null> => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          workspaceId: currentWorkspace!.id,
          task: taskData,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        broadcastEvent('task:created', data.task);
        return data.task;
      }
      return null;
    } catch {
      return null;
    }
  };

  const updateTask = async (task: Task): Promise<Task | null> => {
    // Optimistic local update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    broadcastEvent('task:updated', task);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          workspaceId: currentWorkspace!.id,
          task,
        }),
      });
      const data = await res.json();
      return data.task || null;
    } catch {
      return null;
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    broadcastEvent('task:deleted', { taskId });

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          workspaceId: currentWorkspace!.id,
          taskId,
        }),
      });
      const data = await res.json();
      return data.success ?? false;
    } catch {
      return false;
    }
  };

  // Sprint Actions
  const createSprint = async (sprintData: Partial<Sprint>): Promise<Sprint | null> => {
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          workspaceId: currentWorkspace!.id,
          sprint: sprintData,
        }),
      });
      const data = await res.json();
      if (data.sprint) {
        setSprints((prev) => [data.sprint, ...prev]);
        return data.sprint;
      }
      return null;
    } catch {
      return null;
    }
  };

  const updateSprint = async (sprint: Sprint): Promise<Sprint | null> => {
    setSprints((prev) => prev.map((s) => (s.id === sprint.id ? sprint : s)));
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          workspaceId: currentWorkspace!.id,
          sprint,
        }),
      });
      const data = await res.json();
      return data.sprint || null;
    } catch {
      return null;
    }
  };

  const deleteSprint = async (sprintId: string): Promise<boolean> => {
    setSprints((prev) => prev.filter((s) => s.id !== sprintId));
    setTasks((prev) =>
      prev.map((t) => (t.sprintId === sprintId ? { ...t, sprintId: null } : t))
    );
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          workspaceId: currentWorkspace!.id,
          sprintId,
        }),
      });
      const data = await res.json();
      return data.success ?? false;
    } catch {
      return false;
    }
  };

  const startSprint = async (sprintId: string): Promise<Sprint | null> => {
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          workspaceId: currentWorkspace!.id,
          sprintId,
        }),
      });
      const data = await res.json();
      if (data.sprint) {
        setSprints((prev) => prev.map((s) => (s.id === sprintId ? data.sprint : s)));
        return data.sprint;
      }
      return null;
    } catch {
      return null;
    }
  };

  const completeSprint = async (sprintId: string): Promise<Sprint | null> => {
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          workspaceId: currentWorkspace!.id,
          sprintId,
        }),
      });
      const data = await res.json();
      if (data.sprint) {
        setSprints((prev) => prev.map((s) => (s.id === sprintId ? data.sprint : s)));
        return data.sprint;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Sprint Retrospective & AI Assistant Actions
  const fetchRetroItems = async (sprintId: string): Promise<{ items: RetroItem[]; summary: SprintRetroSummary | null }> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/retro?workspaceId=${currentWorkspace!.id}`);
      const data = await res.json();
      return { items: data.items || [], summary: data.summary || null };
    } catch {
      return { items: [], summary: null };
    }
  };

  const createRetroItem = async (sprintId: string, item: Partial<RetroItem>): Promise<RetroItem | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/retro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: currentWorkspace!.id, item }),
      });
      const data = await res.json();
      return data.item || null;
    } catch {
      return null;
    }
  };

  const voteRetroItem = async (sprintId: string, itemId: string): Promise<RetroItem | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/retro/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: currentWorkspace!.id, itemId }),
      });
      const data = await res.json();
      return data.item || null;
    } catch {
      return null;
    }
  };

  const deleteRetroItem = async (sprintId: string, itemId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/retro?workspaceId=${currentWorkspace!.id}&itemId=${itemId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      return data.success ?? false;
    } catch {
      return false;
    }
  };

  const convertRetroActionToTask = async (
    sprintId: string,
    itemId: string,
    targetSprintId?: string | null
  ): Promise<{ task: Task; retroItem: RetroItem } | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/retro/action-to-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace!.id,
          itemId,
          targetSprintId,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        return { task: data.task, retroItem: data.retroItem };
      }
      return null;
    } catch {
      return null;
    }
  };

  const generateAiRetrospective = async (
    sprintId: string,
    focusArea?: string,
    saveAsDocument?: boolean
  ): Promise<{ summary: SprintRetroSummary; items: RetroItem[]; document?: Document; markdownReport?: string } | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/ai-retro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace!.id,
          focusArea,
          saveAsDocument,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
        }
        return data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const generateAiSprintHealth = async (sprintId: string): Promise<SprintHealthDiagnosis | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace!.id,
          mode: 'health_check',
        }),
      });
      const data = await res.json();
      return data.diagnosis || null;
    } catch {
      return null;
    }
  };

  const generateAiSprintPlan = async (sprintId: string): Promise<SprintPlanRecommendation | null> => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace!.id,
          mode: 'plan_recommendation',
        }),
      });
      const data = await res.json();
      return data.recommendation || null;
    } catch {
      return null;
    }
  };

  // Worklog / Time Tracking Actions
  const logTaskWorkTime = async (taskId: string, hours: number, description: string): Promise<Task | null> => {
    try {
      const res = await fetch('/api/tasks/worklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log',
          workspaceId: currentWorkspace!.id,
          taskId,
          worklog: { hours, description },
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        return data.task;
      }
      return null;
    } catch {
      return null;
    }
  };

  const deleteTaskWorklog = async (taskId: string, worklogId: string): Promise<Task | null> => {
    try {
      const res = await fetch('/api/tasks/worklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          workspaceId: currentWorkspace!.id,
          taskId,
          worklogId,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        return data.task;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Document Actions
  const createDocument = async (docData: Partial<Document>): Promise<Document | null> => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          workspaceId: currentWorkspace!.id,
          document: docData,
        }),
      });
      const data = await res.json();
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setSelectedDocId(data.document.id);
        return data.document;
      }
      return null;
    } catch {
      return null;
    }
  };

  const updateDocument = async (doc: Document, summary?: string): Promise<Document | null> => {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_text',
          workspaceId: currentWorkspace!.id,
          docId: doc.id,
          rawText: doc.rawText,
          title: doc.title,
          changeSummary: summary,
        }),
      });
      const data = await res.json();
      return data.document || null;
    } catch {
      return null;
    }
  };

  const deleteDocument = async (docId: string): Promise<boolean> => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    return true;
  };

  // Comment Actions
  const addComment = async (targetType: 'document' | 'task', targetId: string, content: string): Promise<Comment | null> => {
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          workspaceId: currentWorkspace!.id,
          comment: { targetType, targetId, content },
        }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
        broadcastEvent('comment:created', data.comment);
        return data.comment;
      }
      return null;
    } catch {
      return null;
    }
  };

  const resolveComment = async (commentId: string, resolved: boolean) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved, resolvedBy: resolved ? currentUser!.name : undefined } : c))
    );
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          workspaceId: currentWorkspace!.id,
          commentId,
          resolved,
        }),
      });
    } catch {}
  };

  // File Actions
  const uploadFile = async (fileData: Partial<FileItem>): Promise<FileItem | null> => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          workspaceId: currentWorkspace!.id,
          file: fileData,
        }),
      });
      const data = await res.json();
      if (data.file) {
        setFiles((prev) => [data.file, ...prev]);
        return data.file;
      }
      return null;
    } catch {
      return null;
    }
  };

  const deleteFile = async (fileId: string): Promise<boolean> => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          workspaceId: currentWorkspace!.id,
          fileId,
        }),
      });
      const data = await res.json();
      return data.success ?? false;
    } catch {
      return false;
    }
  };

  const createFirstWorkspace = async (name: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_workspace', name }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.workspace) return false;
      setWorkspaces([data.workspace]);
      setCurrentWorkspace(data.workspace);
      setNeedsWorkspace(false);
      return true;
    } catch {
      return false;
    }
  };

  // A signed-in user with zero workspaces gets a create-workspace prompt
  // instead of the loading spinner — there is nothing left to wait for.
  if (needsWorkspace && currentUser) {
    return <CreateWorkspaceScreen onCreate={createFirstWorkspace} />;
  }

  // Nothing under this provider should ever see a null currentUser/
  // currentWorkspace — every consumer's types assume they're set. Gate
  // rendering here instead of pushing null-checks into every view/component.
  if (!currentUser || !currentWorkspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-300 dark:border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 dark:text-neutral-500">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentUser,
        allUsers,
        workspaces,
        currentWorkspace,
        projects,
        sprints,
        activeSprint,
        tasks,
        documents,
        files,
        comments,
        activities,
        onlineUsers,
        connectionStatus,
        isLoading,
        activeView,
        setActiveView,
        selectedProjectId,
        setSelectedProjectId,
        selectedDocId,
        setSelectedDocId,
        switchWorkspace,
        signOut,
        updateProfile,
        updateProjectHourlyRate,
        createTask,
        updateTask,
        deleteTask,
        createSprint,
        updateSprint,
        deleteSprint,
        startSprint,
        completeSprint,
        fetchRetroItems,
        createRetroItem,
        voteRetroItem,
        deleteRetroItem,
        convertRetroActionToTask,
        generateAiRetrospective,
        generateAiSprintHealth,
        generateAiSprintPlan,
        logTaskWorkTime,
        deleteTaskWorklog,
        createDocument,
        updateDocument,
        deleteDocument,
        addComment,
        resolveComment,
        uploadFile,
        deleteFile,
        broadcastEvent,
        refreshData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// Shown for a signed-in user who isn't a member of any workspace yet —
// e.g. right after sign-up, before they've created or been invited to one.
function CreateWorkspaceScreen({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const ok = await onCreate(name.trim());
    if (!ok) {
      setError('Could not create workspace. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col gap-4"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-neutral-100">Create your workspace</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-500 mt-1">
            You&apos;re signed in, but not part of any workspace yet. Give it a name to get started.
          </p>
        </div>
        <div>
          <label className="text-sm text-slate-500 dark:text-neutral-400 block mb-1.5">Workspace name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 placeholder:text-slate-600 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim() || isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
        >
          {isSubmitting ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
    </div>
  );
}
