'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Layers,
  Users,
  Folder,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Download,
  ArrowRight,
  Info,
  Check,
  Flag,
  Share2,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Task, TaskPriority, TaskStatus, Project, Sprint } from '@/lib/types';
import confetti from 'canvas-confetti';

type TimeScale = 'days' | 'weeks' | 'months';
type GroupBy = 'project' | 'sprint' | 'assignee' | 'none';

interface DependencyLink {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isCritical: boolean;
  hasConflict: boolean;
}

export function GanttTimelineView() {
  const {
    t,
    tasks,
    projects,
    sprints,
    allUsers,
    currentUser,
    currentWorkspace,
    updateTask,
    createTask,
    deleteTask,
    language,
  } = useWorkspace();
  const { success, error, info } = useToast();

  // View Settings & Scale
  const [timeScale, setTimeScale] = useState<TimeScale>('days');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showDependencies, setShowDependencies] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // AI Optimizer Modal
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);
  const [aiOptimizationResult, setAiOptimizationResult] = useState<{
    criticalPathTaskIds: string[];
    adjustedTasks: { id: string; startDate: string; dueDate: string; reason: string }[];
    summary: string;
    bottlenecksFound: string[];
  } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Dragging / Resizing State
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-left' | 'resize-right';
    taskId: string;
    initialMouseX: number;
    initialStartDate: string;
    initialDueDate: string;
    currentStartDate: string;
    currentDueDate: string;
  } | null>(null);

  // Viewport Date Range Calculation
  const [viewDateOffset, setViewDateOffset] = useState<number>(0);

  const baseDate = useMemo(() => {
    const now = new Date('2026-08-28T00:00:00Z');
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const timelineStart = useMemo(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + viewDateOffset - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [baseDate, viewDateOffset]);

  const totalDays = useMemo(() => {
    if (timeScale === 'days') return Math.round(45 / zoomLevel);
    if (timeScale === 'weeks') return Math.round(90 / zoomLevel);
    return Math.round(180 / zoomLevel);
  }, [timeScale, zoomLevel]);

  const dayWidth = useMemo(() => {
    if (timeScale === 'days') return Math.max(36, Math.round(44 * zoomLevel));
    if (timeScale === 'weeks') return Math.max(18, Math.round(24 * zoomLevel));
    return Math.max(10, Math.round(14 * zoomLevel));
  }, [timeScale, zoomLevel]);

  const totalWidth = useMemo(() => {
    return totalDays * dayWidth;
  }, [totalDays, dayWidth]);

  // Date list for column headers
  const dateColumns = useMemo(() => {
    const cols: { date: Date; dateStr: string; isToday: boolean; isWeekend: boolean; dayNum: number; monthName: string; dayName: string }[] = [];
    const todayStr = new Date('2026-08-28T00:00:00Z').toISOString().split('T')[0];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      cols.push({
        date: d,
        dateStr: iso,
        isToday: iso === todayStr,
        isWeekend,
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'es' ? 'es-ES' : 'en-US', { month: 'short' }),
        dayName: d.toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'es' ? 'es-ES' : 'en-US', { weekday: 'narrow' }),
      });
    }
    return cols;
  }, [timelineStart, totalDays, language]);

  // Month header blocks
  const monthHeaders = useMemo(() => {
    const months: { name: string; year: number; startIdx: number; count: number }[] = [];
    let currentMonth = -1;
    let currentCount = 0;
    let startIdx = 0;

    dateColumns.forEach((col, idx) => {
      const m = col.date.getMonth();
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          months.push({
            name: dateColumns[startIdx].monthName,
            year: dateColumns[startIdx].date.getFullYear(),
            startIdx,
            count: currentCount,
          });
        }
        currentMonth = m;
        startIdx = idx;
        currentCount = 1;
      } else {
        currentCount++;
      }
    });

    if (currentCount > 0 && startIdx < dateColumns.length) {
      months.push({
        name: dateColumns[startIdx].monthName,
        year: dateColumns[startIdx].date.getFullYear(),
        startIdx,
        count: currentCount,
      });
    }

    return months;
  }, [dateColumns]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
      if (selectedSprintId !== 'all') {
        if (selectedSprintId === 'backlog' && t.sprintId) return false;
        if (selectedSprintId !== 'backlog' && t.sprintId !== selectedSprintId) return false;
      }
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchLabels = t.labels?.some((l) => l.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchLabels) return false;
      }
      return true;
    });
  }, [tasks, selectedProjectId, selectedSprintId, selectedStatus, searchQuery]);

  // Calculate Critical Path
  const criticalPathSet = useMemo(() => {
    const set = new Set<string>();
    if (aiOptimizationResult?.criticalPathTaskIds) {
      aiOptimizationResult.criticalPathTaskIds.forEach((id) => set.add(id));
      return set;
    }

    const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
    const graph = new Map<string, string[]>();
    tasks.forEach((t) => {
      (t.dependencies || []).forEach((predId) => {
        if (!graph.has(predId)) graph.set(predId, []);
        graph.get(predId)!.push(t.id);
      });
    });

    const getDuration = (t: Task) => {
      const s = new Date(t.startDate || t.createdAt).getTime();
      const e = new Date(t.dueDate).getTime();
      return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    };

    const findMaxPath = (taskId: string): { duration: number; path: string[] } => {
      const task = taskMap.get(taskId);
      if (!task) return { duration: 0, path: [] };
      const succs = graph.get(taskId) || [];
      if (succs.length === 0) {
        return { duration: getDuration(task), path: [taskId] };
      }
      let bestSub = { duration: 0, path: [] as string[] };
      succs.forEach((succId) => {
        const sub = findMaxPath(succId);
        if (sub.duration > bestSub.duration) {
          bestSub = sub;
        }
      });
      return {
        duration: getDuration(task) + bestSub.duration,
        path: [taskId, ...bestSub.path],
      };
    };

    let longest = { duration: 0, path: [] as string[] };
    tasks.forEach((t) => {
      const res = findMaxPath(t.id);
      if (res.duration > longest.duration) {
        longest = res;
      }
    });

    longest.path.forEach((id) => set.add(id));
    return set;
  }, [tasks, aiOptimizationResult]);

  // Grouped structure
  interface TaskGroup {
    id: string;
    title: string;
    badge?: string;
    subtitle?: string;
    tasks: Task[];
    color?: string;
  }

  const taskGroups = useMemo((): TaskGroup[] => {
    if (groupBy === 'project') {
      const groups: TaskGroup[] = projects.map((p) => ({
        id: p.id,
        title: p.name,
        badge: p.key,
        subtitle: p.description,
        color: p.color || '#6366f1',
        tasks: filteredTasks.filter((t) => t.projectId === p.id),
      }));
      const orphanTasks = filteredTasks.filter((t) => !projects.some((p) => p.id === t.projectId));
      if (orphanTasks.length > 0) {
        groups.push({
          id: 'unassigned_project',
          title: t.gantt.unassigned,
          tasks: orphanTasks,
        });
      }
      return groups.filter((g) => g.tasks.length > 0 || selectedProjectId === 'all');
    }

    if (groupBy === 'sprint') {
      const groups: TaskGroup[] = sprints.map((s) => ({
        id: s.id,
        title: s.name,
        badge: s.status.toUpperCase(),
        subtitle: s.goal,
        color: s.status === 'active' ? '#10b981' : '#64748b',
        tasks: filteredTasks.filter((t) => t.sprintId === s.id),
      }));
      const backlogTasks = filteredTasks.filter((t) => !t.sprintId);
      if (backlogTasks.length > 0) {
        groups.push({
          id: 'backlog',
          title: t.gantt.backlog,
          badge: 'BACKLOG',
          color: '#8b5cf6',
          tasks: backlogTasks,
        });
      }
      return groups.filter((g) => g.tasks.length > 0 || selectedSprintId === 'all');
    }

    if (groupBy === 'assignee') {
      const groups: TaskGroup[] = allUsers.map((u) => ({
        id: u.id,
        title: u.name,
        badge: u.role.toUpperCase(),
        color: u.color || '#3b82f6',
        tasks: filteredTasks.filter((t) => t.assigneeId === u.id),
      }));
      const unassigned = filteredTasks.filter((t) => !t.assigneeId);
      if (unassigned.length > 0) {
        groups.push({
          id: 'unassigned_user',
          title: t.gantt.unassigned,
          badge: '—',
          tasks: unassigned,
        });
      }
      return groups.filter((g) => g.tasks.length > 0);
    }

    return [
      {
        id: 'all_tasks',
        title: t.common.appName,
        tasks: filteredTasks,
      },
    ];
  }, [groupBy, projects, sprints, allUsers, filteredTasks, selectedProjectId, selectedSprintId, t]);

  const ROW_HEIGHT = 46;
  const GROUP_HEADER_HEIGHT = 38;

  const rowPositions = useMemo(() => {
    const positions = new Map<string, { task: Task; top: number; left: number; width: number; height: number }>();
    let currentTop = 0;

    taskGroups.forEach((g) => {
      currentTop += GROUP_HEADER_HEIGHT;

      if (!collapsedGroups[g.id]) {
        g.tasks.forEach((t) => {
          const taskStart = new Date(t.startDate || t.createdAt);
          const taskDue = new Date(t.dueDate);

          const startOffsetDays = (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
          const durationDays = Math.max(0.5, (taskDue.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));

          const left = Math.round(startOffsetDays * dayWidth);
          const width = Math.max(28, Math.round(durationDays * dayWidth));

          positions.set(t.id, {
            task: t,
            top: currentTop,
            left,
            width,
            height: ROW_HEIGHT,
          });

          currentTop += ROW_HEIGHT;
        });
      }
    });

    return { positions, totalCanvasHeight: Math.max(400, currentTop + 60) };
  }, [taskGroups, collapsedGroups, timelineStart, dayWidth]);

  const dependencyLinks = useMemo((): DependencyLink[] => {
    if (!showDependencies) return [];
    const links: DependencyLink[] = [];

    tasks.forEach((task) => {
      if (task.dependencies && task.dependencies.length > 0) {
        const toPos = rowPositions.positions.get(task.id);
        if (!toPos) return;

        task.dependencies.forEach((predId) => {
          const fromPos = rowPositions.positions.get(predId);
          if (!fromPos) return;

          const predTask = fromPos.task;
          const predEnd = new Date(predTask.dueDate).getTime();
          const succStart = new Date(task.startDate || task.createdAt).getTime();
          const hasConflict = succStart < predEnd;
          const isCritical = criticalPathSet.has(task.id) && criticalPathSet.has(predId);

          const fromX = fromPos.left + fromPos.width;
          const fromY = fromPos.top + ROW_HEIGHT / 2;
          const toX = toPos.left;
          const toY = toPos.top + ROW_HEIGHT / 2;

          links.push({
            fromId: predId,
            toId: task.id,
            fromX,
            fromY,
            toX,
            toY,
            isCritical,
            hasConflict,
          });
        });
      }
    });

    return links;
  }, [tasks, showDependencies, rowPositions, criticalPathSet]);

  const handleMouseDown = (
    e: React.MouseEvent,
    taskId: string,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setDragState({
      type,
      taskId,
      initialMouseX: e.clientX,
      initialStartDate: task.startDate || task.createdAt.split('T')[0],
      initialDueDate: task.dueDate.split('T')[0],
      currentStartDate: task.startDate || task.createdAt.split('T')[0],
      currentDueDate: task.dueDate.split('T')[0],
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.initialMouseX;
      const deltaDays = Math.round(deltaX / dayWidth);

      if (dragState.type === 'move') {
        const start = new Date(dragState.initialStartDate);
        const due = new Date(dragState.initialDueDate);
        start.setDate(start.getDate() + deltaDays);
        due.setDate(due.getDate() + deltaDays);

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentStartDate: start.toISOString().split('T')[0],
                currentDueDate: due.toISOString().split('T')[0],
              }
            : null
        );
      } else if (dragState.type === 'resize-left') {
        const start = new Date(dragState.initialStartDate);
        start.setDate(start.getDate() + deltaDays);
        const due = new Date(dragState.initialDueDate);

        if (start.getTime() < due.getTime()) {
          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  currentStartDate: start.toISOString().split('T')[0],
                }
              : null
          );
        }
      } else if (dragState.type === 'resize-right') {
        const due = new Date(dragState.initialDueDate);
        due.setDate(due.getDate() + deltaDays);
        const start = new Date(dragState.initialStartDate);

        if (due.getTime() > start.getTime()) {
          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  currentDueDate: due.toISOString().split('T')[0],
                }
              : null
          );
        }
      }
    };

    const handleMouseUp = async () => {
      if (dragState) {
        const task = tasks.find((t) => t.id === dragState.taskId);
        if (task) {
          const updated = {
            ...task,
            startDate: `${dragState.currentStartDate}T09:00:00Z`,
            dueDate: `${dragState.currentDueDate}T18:00:00Z`,
          };
          await updateTask(updated);
          success(t.gantt.rescheduleSuccess);
        }
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dayWidth, tasks, updateTask, success, t]);

  const handleTriggerAiOptimization = async () => {
    setIsAiOptimizing(true);
    try {
      const res = await fetch('/api/ai/gantt-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          tasks,
          language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiOptimizationResult({
          criticalPathTaskIds: data.criticalPathTaskIds,
          adjustedTasks: data.adjustedTasks,
          summary: data.summary,
          bottlenecksFound: data.bottlenecksFound || [],
        });
        setIsAiModalOpen(true);
      } else {
        error(data.error || 'Failed to optimize schedule');
      }
    } catch (err) {
      error('Failed to run AI schedule optimizer');
    } finally {
      setIsAiOptimizing(false);
    }
  };

  const handleApplyAiOptimizations = async () => {
    if (!aiOptimizationResult?.adjustedTasks) return;

    for (const adj of aiOptimizationResult.adjustedTasks) {
      const task = tasks.find((t) => t.id === adj.id);
      if (task) {
        await updateTask({
          ...task,
          startDate: `${adj.startDate}T09:00:00Z`,
          dueDate: `${adj.dueDate}T18:00:00Z`,
        });
      }
    }

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });

    success(t.gantt.optimizationApplied);
    setIsAiModalOpen(false);
  };

  const getStatusColor = (status: TaskStatus, isCritical: boolean) => {
    if (isCritical && showCriticalPath) {
      return {
        bg: 'bg-amber-500/90 text-amber-950 font-semibold shadow-lg shadow-amber-500/20 border-amber-300',
        progress: 'bg-amber-400',
      };
    }
    switch (status) {
      case 'done':
        return {
          bg: 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30',
          progress: 'bg-emerald-400',
        };
      case 'in_progress':
        return {
          bg: 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-900/30',
          progress: 'bg-indigo-400',
        };
      case 'review':
        return {
          bg: 'bg-amber-600 text-white border-amber-500 shadow-amber-900/30',
          progress: 'bg-amber-400',
        };
      case 'todo':
      default:
        return {
          bg: 'bg-neutral-800 text-neutral-200 border-neutral-700 shadow-black/40',
          progress: 'bg-neutral-600',
        };
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        startDate: t.startDate || t.createdAt,
        dueDate: t.dueDate,
        dependencies: t.dependencies || [],
        progress: t.progress || (t.status === 'done' ? 100 : t.status === 'in_progress' ? 50 : 0),
      })),
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowspace_gantt_roadmap_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    success('Gantt Roadmap exported as JSON');
  };

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId);
  }, [tasks, selectedTaskId]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-neutral-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-neutral-950/80 backdrop-blur-md shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {t.gantt.title}
                <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-neutral-400 hidden sm:block">
                {t.gantt.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {/* Time Scale Switcher */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            <button
              onClick={() => setTimeScale('days')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                timeScale === 'days'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.gantt.scaleDays}
            </button>
            <button
              onClick={() => setTimeScale('weeks')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                timeScale === 'weeks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.gantt.scaleWeeks}
            </button>
            <button
              onClick={() => setTimeScale('months')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                timeScale === 'months'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.gantt.scaleMonths}
            </button>
          </div>

          {/* Group By Switcher */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            <button
              onClick={() => setGroupBy('project')}
              title={t.gantt.groupByProject}
              className={`p-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'project' ? 'bg-neutral-800 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.gantt.groupByProject}</span>
            </button>
            <button
              onClick={() => setGroupBy('sprint')}
              title={t.gantt.groupBySprint}
              className={`p-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'sprint' ? 'bg-neutral-800 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.gantt.groupBySprint}</span>
            </button>
            <button
              onClick={() => setGroupBy('assignee')}
              title={t.gantt.groupByAssignee}
              className={`p-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'assignee' ? 'bg-neutral-800 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.gantt.groupByAssignee}</span>
            </button>
            <button
              onClick={() => setGroupBy('none')}
              title={t.gantt.groupByNone}
              className={`p-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'none' ? 'bg-neutral-800 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.gantt.groupByNone}</span>
            </button>
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showCriticalPath
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
            }`}
            title={t.gantt.criticalPathTip}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.gantt.criticalPath}</span>
          </button>

          {/* AI Schedule Optimizer */}
          <button
            onClick={handleTriggerAiOptimization}
            disabled={isAiOptimizing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md shadow-indigo-600/30 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiOptimizing ? 'animate-spin' : ''}`} />
            <span>{isAiOptimizing ? t.gantt.optimizing : t.gantt.aiOptimizerBtn}</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            title={t.gantt.exportJson}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Date Navigation Toolbar */}
      <div className="px-4 py-2.5 bg-neutral-900/50 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          {/* Search */}
          <div className="relative min-w-[160px] max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.common.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t.gantt.filterProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Sprint Filter */}
          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t.gantt.filterSprint}</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="backlog">{t.gantt.backlog}</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t.gantt.filterStatus}</option>
            <option value="todo">{t.tasks.todo}</option>
            <option value="in_progress">{t.tasks.inProgress}</option>
            <option value="review">{t.tasks.review}</option>
            <option value="done">{t.tasks.done}</option>
          </select>

          {/* Toggle dependencies visibility */}
          <label className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => setShowDependencies(e.target.checked)}
              className="rounded border-neutral-700 text-indigo-600 focus:ring-0 bg-neutral-900"
            />
            <span>{t.gantt.showDependencies}</span>
          </label>
        </div>

        {/* Timeline Range Navigation Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setViewDateOffset((prev) => prev - (timeScale === 'days' ? 7 : 14))}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Prev Period"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewDateOffset(0)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 font-medium transition-colors"
          >
            {t.gantt.today}
          </button>
          <button
            onClick={() => setViewDateOffset((prev) => prev + (timeScale === 'days' ? 7 : 14))}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Next Period"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title={t.gantt.zoomOut}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-3xs font-mono text-neutral-400 w-8 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title={t.gantt.zoomIn}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Gantt Split Viewport */}
      <div className="flex-1 flex overflow-hidden relative select-none">
        {/* Left Tasks Tree Column */}
        <div className="w-80 md:w-96 border-r border-neutral-800 bg-neutral-950 flex flex-col shrink-0 z-20 shadow-xl">
          {/* Header Row */}
          <div className="h-16 border-b border-neutral-800 bg-neutral-900/60 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t.common.appName} Tasks ({filteredTasks.length})
            </span>
            <span className="text-3xs text-neutral-500 font-mono">
              {dependencyLinks.length} {t.gantt.dependenciesCount}
            </span>
          </div>

          {/* Task Tree List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {taskGroups.map((g) => {
              const isCollapsed = collapsedGroups[g.id];
              return (
                <div key={g.id} className="border-b border-neutral-800/40">
                  {/* Group Header */}
                  <div
                    onClick={() =>
                      setCollapsedGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                    }
                    className="h-[38px] px-3 bg-neutral-900/80 border-b border-neutral-800/60 flex items-center justify-between cursor-pointer hover:bg-neutral-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                          !isCollapsed ? 'rotate-90' : ''
                        }`}
                      />
                      {g.color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                      )}
                      <span className="text-xs font-bold text-neutral-200 truncate">
                        {g.title}
                      </span>
                      {g.badge && (
                        <span className="text-3xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                          {g.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-2xs text-neutral-500 font-mono">
                      {g.tasks.length}
                    </span>
                  </div>

                  {/* Task Rows */}
                  {!isCollapsed &&
                    g.tasks.map((tItem) => {
                      const isSelected = selectedTaskId === tItem.id;
                      const isCritical = criticalPathSet.has(tItem.id);
                      return (
                        <div
                          key={tItem.id}
                          onClick={() => setSelectedTaskId(tItem.id)}
                          className={`h-[46px] px-3.5 flex items-center justify-between border-b border-neutral-800/40 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/40 border-l-2 border-l-indigo-500'
                              : 'hover:bg-neutral-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {isCritical && showCriticalPath && (
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse"
                                title="Critical Path Task"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs text-neutral-200 truncate font-medium">
                                {tItem.title}
                              </p>
                              <div className="flex items-center gap-2 text-3xs text-neutral-500 font-mono">
                                <span>SP: {tItem.storyPoints || 3}</span>
                                <span>•</span>
                                <span>
                                  {tItem.startDate?.split('T')[0] || tItem.createdAt.split('T')[0]} →{' '}
                                  {tItem.dueDate.split('T')[0]}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {tItem.assignee ? (
                              <Avatar
                                src={tItem.assignee.avatar}
                                name={tItem.assignee.name}
                                color={tItem.assignee.color}
                                title={tItem.assignee.name}
                                className="w-5 h-5 rounded-full object-cover border border-neutral-700"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-3xs text-neutral-500">
                                ?
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="p-8 text-center text-xs text-neutral-500">
                {t.gantt.noTasksFound}
              </div>
            )}
          </div>
        </div>

        {/* Right Timeline / Gantt Canvas */}
        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto custom-scrollbar relative bg-neutral-950">
          <div
            style={{ width: totalWidth, height: rowPositions.totalCanvasHeight }}
            className="relative select-none"
          >
            {/* Sticky Header: Months & Days */}
            <div className="sticky top-0 z-30 bg-neutral-950/95 border-b border-neutral-800 backdrop-blur-md">
              {/* Months Row */}
              <div className="h-8 flex border-b border-neutral-800/80">
                {monthHeaders.map((m, idx) => (
                  <div
                    key={idx}
                    style={{ width: m.count * dayWidth }}
                    className="h-full px-2 flex items-center text-xs font-semibold text-neutral-300 border-r border-neutral-800/60 bg-neutral-900/40"
                  >
                    {m.name} {m.year}
                  </div>
                ))}
              </div>

              {/* Days Row */}
              <div className="h-8 flex">
                {dateColumns.map((col, idx) => (
                  <div
                    key={idx}
                    style={{ width: dayWidth }}
                    className={`h-full flex flex-col items-center justify-center text-3xs border-r border-neutral-800/40 transition-colors ${
                      col.isToday
                        ? 'bg-indigo-950/60 text-indigo-300 font-bold'
                        : col.isWeekend
                        ? 'bg-neutral-900/40 text-neutral-500'
                        : 'text-neutral-400'
                    }`}
                  >
                    <span className="font-mono">{col.dayNum}</span>
                    <span className="text-4xs opacity-70">{col.dayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Background Grid Columns & Weekend Shading */}
            <div className="absolute top-16 left-0 right-0 bottom-0 flex pointer-events-none z-0">
              {dateColumns.map((col, idx) => (
                <div
                  key={idx}
                  style={{ width: dayWidth }}
                  className={`h-full border-r border-neutral-800/30 ${
                    col.isToday
                      ? 'bg-indigo-500/5'
                      : col.isWeekend
                      ? 'bg-neutral-900/20'
                      : ''
                  }`}
                />
              ))}
            </div>

            {/* "Today" Vertical Indicator Line */}
            {dateColumns.map((col, idx) => {
              if (!col.isToday) return null;
              return (
                <div
                  key={`today-line-${idx}`}
                  style={{ left: idx * dayWidth + dayWidth / 2 }}
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                >
                  <div className="sticky top-16 -ml-5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-3xs font-mono font-bold uppercase tracking-wider shadow-md">
                    Today
                  </div>
                </div>
              );
            })}

            {/* SVG Layer for Dependency Connectors */}
            <svg
              className="absolute top-16 left-0 w-full h-full pointer-events-none z-10 overflow-visible"
              style={{ width: totalWidth, height: rowPositions.totalCanvasHeight - 64 }}
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-conflict"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                </marker>
              </defs>

              {dependencyLinks.map((link, idx) => {
                const isConflict = link.hasConflict;
                const isCritical = link.isCritical && showCriticalPath;

                const dx = link.toX - link.fromX;
                const curveOffset = Math.max(20, Math.min(60, Math.abs(dx) / 2));

                const pathData = `M ${link.fromX} ${link.fromY} C ${link.fromX + curveOffset} ${link.fromY}, ${link.toX - curveOffset} ${link.toY}, ${link.toX} ${link.toY}`;

                return (
                  <g key={`dep-${link.fromId}-${link.toId}-${idx}`}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={
                        isConflict
                          ? '#f43f5e'
                          : isCritical
                          ? '#f59e0b'
                          : '#6366f1'
                      }
                      strokeWidth={isCritical ? 2.5 : isConflict ? 2 : 1.5}
                      strokeDasharray={isConflict ? '4,4' : undefined}
                      markerEnd={
                        isConflict
                          ? 'url(#arrow-conflict)'
                          : isCritical
                          ? 'url(#arrow-critical)'
                          : 'url(#arrow-default)'
                      }
                      className="transition-all opacity-85 hover:opacity-100"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Task Bars Layer */}
            <div className="absolute top-16 left-0 w-full z-10">
              {taskGroups.map((g) => {
                const isCollapsed = collapsedGroups[g.id];
                return (
                  <div key={`canvas-group-${g.id}`}>
                    <div className="h-[38px] bg-neutral-900/30 border-b border-neutral-800/40 flex items-center px-4">
                      <span className="text-3xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                        {g.title}
                      </span>
                    </div>

                    {!isCollapsed &&
                      g.tasks.map((tItem) => {
                        const isDraggingThis = dragState?.taskId === tItem.id;
                        const isSelected = selectedTaskId === tItem.id;
                        const isCritical = criticalPathSet.has(tItem.id);

                        const startStr =
                          isDraggingThis && dragState
                            ? dragState.currentStartDate
                            : tItem.startDate || tItem.createdAt.split('T')[0];
                        const dueStr =
                          isDraggingThis && dragState
                            ? dragState.currentDueDate
                            : tItem.dueDate.split('T')[0];

                        const taskStart = new Date(startStr);
                        const taskDue = new Date(dueStr);

                        const startOffsetDays = (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
                        const durationDays = Math.max(0.5, (taskDue.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));

                        const left = Math.round(startOffsetDays * dayWidth);
                        const width = Math.max(28, Math.round(durationDays * dayWidth));

                        const colors = getStatusColor(tItem.status, isCritical);
                        const progress =
                          tItem.progress ?? (tItem.status === 'done' ? 100 : tItem.status === 'in_progress' ? 50 : 0);

                        return (
                          <div
                            key={`bar-${tItem.id}`}
                            className="h-[46px] relative border-b border-neutral-800/20 flex items-center"
                          >
                            <div
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                              }}
                              onClick={() => setSelectedTaskId(tItem.id)}
                              onMouseDown={(e) => handleMouseDown(e, tItem.id, 'move')}
                              className={`absolute h-7 rounded-lg border flex items-center justify-between px-2 cursor-grab active:cursor-grabbing transition-shadow group select-none shadow-md ${
                                colors.bg
                              } ${
                                isSelected
                                  ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-neutral-950'
                                  : ''
                              }`}
                            >
                              <div
                                onMouseDown={(e) => handleMouseDown(e, tItem.id, 'resize-left')}
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l hover:bg-white/60 transition-opacity"
                              />

                              <div
                                style={{ width: `${progress}%` }}
                                className={`absolute left-0 top-0 bottom-0 rounded-l-lg opacity-25 ${colors.progress}`}
                              />

                              <div className="relative z-10 flex items-center gap-1.5 min-w-0 pr-1">
                                <span className="text-2xs font-semibold truncate leading-tight">
                                  {tItem.title}
                                </span>
                              </div>

                              <div className="relative z-10 flex items-center gap-1 text-3xs font-mono opacity-80 shrink-0">
                                <span>{Math.round(durationDays)}d</span>
                              </div>

                              <div
                                onMouseDown={(e) => handleMouseDown(e, tItem.id, 'resize-right')}
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-r hover:bg-white/60 transition-opacity"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Task Detail & Dependency Inspector Drawer */}
      {selectedTask && (
        <div className="border-t border-neutral-800 bg-neutral-900 p-4 shrink-0 shadow-2xl z-30 animate-in slide-in-from-bottom-6">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-3xs px-2 py-0.5 rounded-full font-bold uppercase ${
                    selectedTask.status === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : selectedTask.status === 'in_progress'
                      ? 'bg-blue-500/20 text-blue-300'
                      : selectedTask.status === 'review'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {selectedTask.status}
                </span>
                <span
                  className={`text-3xs px-2 py-0.5 rounded-full font-bold uppercase ${
                    selectedTask.priority === 'urgent'
                      ? 'bg-rose-500/20 text-rose-300'
                      : selectedTask.priority === 'high'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {selectedTask.priority}
                </span>
                <h3 className="text-sm font-bold text-neutral-100 truncate">
                  {selectedTask.title}
                </h3>
              </div>

              {/* Dependency Links */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-semibold">{t.gantt.dependsOn}</span>
                  {(selectedTask.dependencies || []).length === 0 ? (
                    <span className="text-neutral-600 text-2xs italic">
                      {t.gantt.noDependencies}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      {selectedTask.dependencies?.map((predId) => {
                        const pred = tasks.find((t) => t.id === predId);
                        return (
                          <span
                            key={predId}
                            className="text-3xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 flex items-center gap-1 font-mono"
                          >
                            <ArrowRight className="w-2.5 h-2.5 text-indigo-400" />
                            {pred ? pred.title.slice(0, 24) + '...' : predId}
                            <button
                              onClick={async () => {
                                const newDeps = (selectedTask.dependencies || []).filter(
                                  (id) => id !== predId
                                );
                                await updateTask({ ...selectedTask, dependencies: newDeps });
                                success(t.gantt.rescheduleSuccess);
                              }}
                              className="hover:text-rose-400 ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Dependency Dropdown */}
                <select
                  onChange={async (e) => {
                    const predId = e.target.value;
                    if (!predId) return;
                    if (predId === selectedTask.id) return;
                    const curDeps = selectedTask.dependencies || [];
                    if (!curDeps.includes(predId)) {
                      await updateTask({
                        ...selectedTask,
                        dependencies: [...curDeps, predId],
                      });
                      success(t.gantt.rescheduleSuccess);
                    }
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="px-2 py-0.5 text-2xs rounded bg-neutral-800 border border-neutral-700 text-neutral-300 focus:outline-none"
                >
                  <option value="" disabled>
                    + {t.gantt.addDependency}
                  </option>
                  {tasks
                    .filter((t) => t.id !== selectedTask.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Quick Adjusters */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Progress Slider */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400">{t.gantt.progress}:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={selectedTask.progress ?? 0}
                  onChange={async (e) => {
                    const prog = parseInt(e.target.value, 10);
                    await updateTask({ ...selectedTask, progress: prog });
                  }}
                  className="w-24 accent-indigo-500 bg-neutral-800"
                />
                <span className="text-xs font-mono text-neutral-300 w-8">
                  {selectedTask.progress ?? 0}%
                </span>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedTaskId(null)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Schedule Optimizer Findings Modal */}
      {isAiModalOpen && aiOptimizationResult && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {t.gantt.aiOptimizer}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {t.gantt.aiOptimizerDesc}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {/* Summary */}
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 leading-relaxed">
                <strong className="block text-indigo-300 font-semibold mb-1">
                  Executive Summary:
                </strong>
                {aiOptimizationResult.summary}
              </div>

              {/* Adjustments Table */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Proposed Date Realignment ({aiOptimizationResult.adjustedTasks.length}):
                </h4>
                <div className="space-y-2">
                  {aiOptimizationResult.adjustedTasks.map((adj) => {
                    const task = tasks.find((t) => t.id === adj.id);
                    return (
                      <div
                        key={adj.id}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-200">
                            {task?.title || adj.id}
                          </span>
                          <span className="text-3xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {adj.startDate} → {adj.dueDate}
                          </span>
                        </div>
                        {adj.reason && (
                          <p className="text-2xs text-neutral-400">{adj.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleApplyAiOptimizations}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 hover:opacity-95"
              >
                Apply All Adjustments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
