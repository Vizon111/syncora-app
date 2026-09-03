'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckSquare,
  ShieldCheck,
  Clock,
  MessageSquare,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Zap,
  Play,
  Flame,
  FileSpreadsheet,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { AiTaskBreakdown } from '@/components/tasks/ai-task-breakdown';
import { TimeTrackingModal } from '@/components/modals/time-tracking-modal';
import { ExportStandupModal } from '@/components/modals/export-standup-modal';
import { AutomationsModal } from '@/components/modals/automations-modal';
import confetti from 'canvas-confetti';

export function TasksKanbanView() {
  const {
    t,
    tasks,
    projects,
    allUsers,
    currentUser,
    currentWorkspace,
    sprints,
    activeSprint,
    createTask,
    updateTask,
    deleteTask,
    comments,
    addComment,
  } = useWorkspace();
  const { success, error } = useToast();

  const COLUMNS: { id: TaskStatus; label: string; color: string; badgeBg: string }[] = [
    { id: 'todo', label: t.tasks.todo, color: 'border-slate-300 dark:border-neutral-700', badgeBg: 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300' },
    { id: 'in_progress', label: t.tasks.inProgress, color: 'border-blue-500/40', badgeBg: 'bg-blue-500/10 text-blue-400' },
    { id: 'review', label: t.tasks.review, color: 'border-amber-500/40', badgeBg: 'bg-amber-500/10 text-amber-400' },
    { id: 'done', label: t.tasks.done, color: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/10 text-emerald-400' },
  ];

  const PRIORITIES: { id: TaskPriority; label: string; color: string }[] = [
    { id: 'urgent', label: t.tasks.priorityBlocker, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { id: 'high', label: t.tasks.priorityHigh, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'medium', label: t.tasks.priorityMedium, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { id: 'low', label: t.tasks.priorityLow, color: 'text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 border-slate-300 dark:border-neutral-700' },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSprint, setFilterSprint] = useState<string>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [timeTrackingTask, setTimeTrackingTask] = useState<Task | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Create form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProject, setNewTaskProject] = useState(projects[0]?.id || 'prj_flowspace_core');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUser.id);
  const [newTaskLabels, setNewTaskLabels] = useState('Frontend, AI');
  const [newTaskStoryPoints, setNewTaskStoryPoints] = useState<number>(3);
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState<number>(4);
  const [newTaskSprintId, setNewTaskSprintId] = useState<string>(activeSprint?.id || '');
  const [newTaskSubtasks, setNewTaskSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newTaskAcceptanceCriteria, setNewTaskAcceptanceCriteria] = useState<{ id: string; text: string; satisfied: boolean }[]>([]);
  const [newDrawerSubtask, setNewDrawerSubtask] = useState('');
  const [newDrawerCriteria, setNewDrawerCriteria] = useState('');

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || t.projectId === filterProject;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    
    let matchesSprint = true;
    if (filterSprint === 'backlog') {
      matchesSprint = !t.sprintId;
    } else if (filterSprint === 'active') {
      matchesSprint = t.sprintId === activeSprint?.id;
    } else if (filterSprint !== 'all') {
      matchesSprint = t.sprintId === filterSprint;
    }

    return matchesSearch && matchesProject && matchesPriority && matchesSprint;
  });

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }

    const previousStatus = task.status;

    // Trigger celebratory confetti when completing a task
    if (targetStatus === 'done') {
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#6366f1', '#10b981', '#06b6d4'],
        });
      } catch {}
    }

    const updated = await updateTask({
      ...task,
      status: targetStatus,
    });

    if (updated) {
      const colName = COLUMNS.find((c) => c.id === targetStatus)?.label || targetStatus;
      success(
        `${t.toasts.taskMoved}: «${task.title}» → ${colName}`,
        undefined,
        async () => {
          await updateTask({
            ...task,
            status: previousStatus,
          });
        }
      );
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }

    const created = await createTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      projectId: newTaskProject,
      priority: newTaskPriority,
      assigneeId: newTaskAssignee,
      status: 'todo',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      labels: newTaskLabels.split(',').map((l) => l.trim()).filter(Boolean),
      storyPoints: newTaskStoryPoints || 3,
      estimatedHours: newTaskEstimatedHours || 4,
      loggedHours: 0,
      sprintId: newTaskSprintId || undefined,
      subtasks: newTaskSubtasks,
      acceptanceCriteria: newTaskAcceptanceCriteria,
    });

    if (created) {
      success(
        `${t.toasts.taskCreated}: «${created.title}»`,
        undefined,
        async () => {
          await deleteTask(created.id);
        }
      );
    }

    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskStoryPoints(3);
    setNewTaskEstimatedHours(4);
    setNewTaskSubtasks([]);
    setNewTaskAcceptanceCriteria([]);
    setIsCreateOpen(false);
  };

  const handleToggleSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const updated = await updateTask({
      ...task,
      subtasks: updatedSubtasks,
    });
    if (selectedTask?.id === task.id && updated) {
      setSelectedTask(updated);
    }
  };

  const handleToggleCriteria = async (task: Task, criteriaId: string) => {
    const updatedCriteria = (task.acceptanceCriteria || []).map((c) =>
      c.id === criteriaId ? { ...c, satisfied: !c.satisfied } : c
    );
    const updated = await updateTask({
      ...task,
      acceptanceCriteria: updatedCriteria,
    });
    if (selectedTask?.id === task.id && updated) {
      setSelectedTask(updated);
    }
  };

  const handleAddDrawerSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newDrawerSubtask.trim()) return;
    const newSt = {
      id: `st_${Date.now()}`,
      title: newDrawerSubtask.trim(),
      completed: false,
    };
    const updated = await updateTask({
      ...selectedTask,
      subtasks: [...(selectedTask.subtasks || []), newSt],
    });
    if (updated) {
      setSelectedTask(updated);
      setNewDrawerSubtask('');
    }
  };

  const handleAddDrawerCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newDrawerCriteria.trim()) return;
    const newCr = {
      id: `ac_${Date.now()}`,
      text: newDrawerCriteria.trim(),
      satisfied: false,
    };
    const updated = await updateTask({
      ...selectedTask,
      acceptanceCriteria: [...(selectedTask.acceptanceCriteria || []), newCr],
    });
    if (updated) {
      setSelectedTask(updated);
      setNewDrawerCriteria('');
    }
  };

  const handleDeleteDrawerSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    const updated = await updateTask({
      ...selectedTask,
      subtasks: (selectedTask.subtasks || []).filter((s) => s.id !== subtaskId),
    });
    if (updated) setSelectedTask(updated);
  };

  const handleDeleteDrawerCriteria = async (criteriaId: string) => {
    if (!selectedTask) return;
    const updated = await updateTask({
      ...selectedTask,
      acceptanceCriteria: (selectedTask.acceptanceCriteria || []).filter((c) => c.id !== criteriaId),
    });
    if (updated) setSelectedTask(updated);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;

    await addComment('task', selectedTask.id, newCommentText.trim());
    setNewCommentText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full p-6 max-w-7xl mx-auto w-full animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-100">{t.tasks.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t.tasks.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAutomationsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 hover:text-white rounded-lg transition-colors"
            title={t.automations.title}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{t.automations.btn}</span>
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 hover:text-white rounded-lg transition-colors"
            title={t.exportStandup.title}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{t.exportStandup.btn}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-600/20 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            <span>{t.tasks.newTask}</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-indigo-700/80 text-indigo-100 font-mono text-3xs border border-indigo-500/50">
              C
            </kbd>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 py-4">
        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 dark:text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.tasks.searchTasks}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-500" />
          <span>{t.tasks.project}:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-neutral-200 focus:outline-hidden text-xs cursor-pointer"
          >
            <option value="all">{t.tasks.filterAll}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5">
          <span>{t.tasks.priorityLabel}:</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-neutral-200 focus:outline-hidden text-xs cursor-pointer"
          >
            <option value="all">{t.tasks.filterPriority}</option>
            {PRIORITIES.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sprint Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>{t.tasks.sprint}:</span>
          <select
            value={filterSprint}
            onChange={(e) => setFilterSprint(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-neutral-200 focus:outline-hidden text-xs cursor-pointer max-w-[140px] truncate"
          >
            <option value="all">{t.tasks.filterSprint}</option>
            <option value="active">{t.tasks.activeSprintOnly}</option>
            <option value="backlog">{t.tasks.backlogOnly}</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-2xs text-slate-500 dark:text-neutral-500">
          {filteredTasks.length} / {tasks.length}
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col rounded-xl bg-white/60 dark:bg-neutral-900/60 border ${
                isOver ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-200/80 dark:border-neutral-800/80'
              } p-3 transition-colors min-w-[270px] max-h-[calc(100vh-250px)]`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/60 dark:border-neutral-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">{col.label}</span>
                  <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setNewTaskProject(projects[0]?.id || 'prj_flowspace_core');
                    setIsCreateOpen(true);
                  }}
                  className="p-1 text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks List Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                {colTasks.map((task) => {
                  const completedSubtasks = (task.subtasks || []).filter((s) => s.completed).length;
                  const totalSubtasks = (task.subtasks || []).length;
                  const priorityMeta = PRIORITIES.find((p) => p.id === task.priority);
                  const taskSprint = sprints.find((s) => s.id === task.sprintId);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => setSelectedTask(task)}
                      className={`group p-3.5 rounded-lg bg-slate-50/90 dark:bg-neutral-950/90 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg ${
                        draggedTaskId === task.id ? 'opacity-40 border-dashed border-indigo-400' : ''
                      }`}
                    >
                      {/* Priority, Sprint and SP */}
                      <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-2xs px-2 py-0.5 rounded-full font-semibold border ${priorityMeta?.color}`}
                          >
                            {priorityMeta?.label}
                          </span>
                          <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/40">
                            ⚡ {task.storyPoints || 3} SP
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {taskSprint ? (
                            <span className="text-3xs font-medium text-amber-300 bg-amber-950/50 border border-amber-800/40 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                              {taskSprint.name}
                            </span>
                          ) : (
                            <span className="text-3xs font-normal text-slate-500 dark:text-neutral-500 bg-white dark:bg-neutral-900 px-1.5 py-0.5 rounded">
                              Backlog
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task Title */}
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-neutral-100 group-hover:text-indigo-400 line-clamp-2 transition-colors">
                        {task.title}
                      </h4>

                      {/* Subtasks Progress */}
                      {totalSubtasks > 0 && (
                        <div className="mt-2.5 flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400">
                          <div className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-slate-500 dark:text-neutral-500" />
                            <span>
                              {completedSubtasks}/{totalSubtasks} {t.tasks.subtasks}
                            </span>
                          </div>
                          <div className="w-16 h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Acceptance Criteria Progress */}
                      {(task.acceptanceCriteria || []).length > 0 && (
                        <div className="mt-1.5 flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400">
                          <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>
                              {(task.acceptanceCriteria || []).filter((c) => c.satisfied).length}/
                              {(task.acceptanceCriteria || []).length} DoD
                            </span>
                          </div>
                          <div className="w-16 h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{
                                width: `${
                                  ((task.acceptanceCriteria || []).filter((c) => c.satisfied).length /
                                    (task.acceptanceCriteria || []).length) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer: Assignee & Time Tracking Button */}
                      <div className="mt-3 pt-2.5 border-t border-slate-300 dark:border-neutral-900 flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-500">
                        <div className="flex items-center gap-1.5">
                          {task.assignee ? (
                            <Avatar
                              src={task.assignee.avatar}
                              name={task.assignee.name}
                              color={task.assignee.color}
                              title={`${t.tasks.assignedTo} ${task.assignee.name}`}
                              className="w-5 h-5 rounded-full object-cover border border-slate-300 dark:border-neutral-700"
                            />
                          ) : (
                            <span className="text-slate-600 dark:text-neutral-300 italic">{t.tasks.unassigned}</span>
                          )}
                          <span className="text-slate-500 dark:text-neutral-400 truncate max-w-[70px]">
                            {task.assignee?.name?.split(' ')[0]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Quick Time Tracking trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeTrackingTask(task);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-violet-300 border border-violet-900/40 transition-colors"
                            title="Логирование и таймер"
                          >
                            <Clock className="w-3 h-3 text-violet-400" />
                            <span>{task.loggedHours || 0}/{task.estimatedHours || 4}h</span>
                          </button>

                          {(task.commentsCount || 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-slate-500 dark:text-neutral-400">
                              <MessageSquare className="w-3 h-3" />
                              <span>{task.commentsCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="py-8 text-center border border-dashed border-slate-200/60 dark:border-neutral-800/60 rounded-lg text-2xs text-slate-600 dark:text-neutral-300">
                    {t.tasks.dropTasksHere}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-16 p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-950/60">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {t.tasks.createTaskModalTitle}
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.tasks.titleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={t.tasks.titlePlaceholder}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.tasks.descLabel}
                </label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder={t.tasks.descPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.tasks.projectLabel}
                  </label>
                  <select
                    value={newTaskProject}
                    onChange={(e) => setNewTaskProject(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.tasks.priorityLabel}
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  >
                    {PRIORITIES.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.tasks.assigneeLabel}
                  </label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.tasks.labelsLabel}
                  </label>
                  <input
                    type="text"
                    value={newTaskLabels}
                    onChange={(e) => setNewTaskLabels(e.target.value)}
                    placeholder={t.tasks.labelsPlaceholder}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Sprint and Story Points & Estimated Hours */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-neutral-950/60 border border-slate-200/60 dark:border-neutral-800/60">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {t.tasks.sprint}
                  </label>
                  <select
                    value={newTaskSprintId}
                    onChange={(e) => setNewTaskSprintId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  >
                    <option value="">{t.tasks.backlog}</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.status === 'active' ? '🔥' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    ⚡ {t.tasks.storyPoints}
                  </label>
                  <select
                    value={newTaskStoryPoints}
                    onChange={(e) => setNewTaskStoryPoints(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden font-mono font-bold"
                  >
                    {[1, 2, 3, 5, 8, 13, 21].map((pts) => (
                      <option key={pts} value={pts}>
                        {pts} SP
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    {t.tasks.estimatedHours}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={newTaskEstimatedHours}
                    onChange={(e) => setNewTaskEstimatedHours(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* AI Subtasks and Acceptance Criteria generator */}
              <AiTaskBreakdown
                title={newTaskTitle}
                description={newTaskDesc}
                projectId={newTaskProject}
                subtasks={newTaskSubtasks}
                acceptanceCriteria={newTaskAcceptanceCriteria}
                onSubtasksChange={setNewTaskSubtasks}
                onAcceptanceCriteriaChange={setNewTaskAcceptanceCriteria}
                onApplyPriority={setNewTaskPriority}
                onApplyStoryPoints={setNewTaskStoryPoints}
                onApplyEstimatedHours={setNewTaskEstimatedHours}
                onApplyLabels={(labels) => {
                  const existing = newTaskLabels.split(',').map((s) => s.trim()).filter(Boolean);
                  const combined = Array.from(new Set([...existing, ...labels]));
                  setNewTaskLabels(combined.join(', '));
                }}
              />

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {t.tasks.createButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details & Subtasks & Acceptance Criteria Drawer / Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${
                    PRIORITIES.find((p) => p.id === selectedTask.priority)?.color
                  }`}
                >
                  {selectedTask.priority.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-400">Task #{selectedTask.id.slice(-4)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (currentUser.role === 'viewer') {
                      error(t.toasts.permDenied);
                      return;
                    }
                    const taskToDelete = { ...selectedTask };
                    const deleted = await deleteTask(taskToDelete.id);
                    if (deleted) {
                      setSelectedTask(null);
                      success(
                        `${t.toasts.taskDeleted}: «${taskToDelete.title}»`,
                        undefined,
                        async () => {
                          await createTask(taskToDelete);
                        }
                      );
                    }
                  }}
                  className="p-1.5 text-slate-500 dark:text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                  title={t.tasks.deleteTask}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-neutral-100">{selectedTask.title}</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">{selectedTask.description || t.tasks.noDescription}</p>
                {selectedTask.labels && selectedTask.labels.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {selectedTask.labels.map((lbl) => (
                      <span key={lbl} className="text-2xs bg-slate-100/80 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 px-2 py-0.5 rounded-md border border-slate-300/50 dark:border-neutral-700/50">
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Status and Assignee Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-neutral-950 p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs">
                <div>
                  <span className="text-2xs text-slate-500 dark:text-neutral-500 uppercase tracking-wider block">{t.tasks.statusLabel}</span>
                  <select
                    value={selectedTask.status}
                    onChange={async (e) => {
                      const updated = await updateTask({
                        ...selectedTask,
                        status: e.target.value as TaskStatus,
                      });
                      if (updated) setSelectedTask(updated);
                    }}
                    className="mt-1 bg-transparent text-slate-700 dark:text-neutral-200 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-2xs text-slate-500 dark:text-neutral-500 uppercase tracking-wider block">{t.tasks.assigneeLabel}</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {selectedTask.assignee?.avatar && (
                      <Avatar
                        src={selectedTask.assignee.avatar}
                        name={selectedTask.assignee.name}
                        color={selectedTask.assignee.color}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span className="text-slate-700 dark:text-neutral-200 font-medium">{selectedTask.assignee?.name || t.tasks.unassigned}</span>
                  </div>
                </div>

                <div>
                  <span className="text-2xs text-slate-500 dark:text-neutral-500 uppercase tracking-wider block">{t.tasks.dueDate}</span>
                  <span className="mt-1 text-slate-700 dark:text-neutral-200 block">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : t.tasks.none}
                  </span>
                </div>

                <div>
                  <span className="text-2xs text-slate-500 dark:text-neutral-500 uppercase tracking-wider block">{t.tasks.reporterLabel}</span>
                  <span className="mt-1 text-slate-700 dark:text-neutral-200 block">{selectedTask.reporter?.name || t.tasks.teamDefault}</span>
                </div>
              </div>

              {/* Sprint, Story Points & Time Tracking Section */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200/80 dark:border-neutral-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                      {t.sprints.title} & {t.timeTracking.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTimeTrackingTask(selectedTask)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-violet-300 bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span>{t.timeTracking.logTime} / {t.timeTracking.timer}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                    <span className="text-2xs text-slate-500 dark:text-neutral-400 block mb-1">{t.tasks.sprint}</span>
                    <select
                      value={selectedTask.sprintId || ''}
                      onChange={async (e) => {
                        const newSprintId = e.target.value || undefined;
                        const updated = await updateTask({
                          ...selectedTask,
                          sprintId: newSprintId,
                        });
                        if (updated) setSelectedTask(updated);
                      }}
                      className="w-full bg-transparent text-amber-300 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="" className="bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300">{t.tasks.backlog}</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id} className="bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200">
                          {s.name} {s.status === 'active' ? '🔥' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                    <span className="text-2xs text-slate-500 dark:text-neutral-400 block mb-1">⚡ {t.tasks.storyPoints}</span>
                    <select
                      value={selectedTask.storyPoints || 3}
                      onChange={async (e) => {
                        const updated = await updateTask({
                          ...selectedTask,
                          storyPoints: Number(e.target.value),
                        });
                        if (updated) setSelectedTask(updated);
                      }}
                      className="w-full bg-transparent text-violet-300 font-mono font-bold focus:outline-hidden cursor-pointer"
                    >
                      {[1, 2, 3, 5, 8, 13, 21].map((pts) => (
                        <option key={pts} value={pts} className="bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200">
                          {pts} Story Points
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                    <span className="text-2xs text-slate-500 dark:text-neutral-400 block mb-1">⏱ {t.timeTracking.logged} / {t.timeTracking.estimated}</span>
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-emerald-400">{selectedTask.loggedHours || 0}h</span>
                      <span className="text-slate-500 dark:text-neutral-500">/</span>
                      <span className="text-slate-600 dark:text-neutral-300">{selectedTask.estimatedHours || 4}h</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acceptance Criteria (DoD) Section */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200/80 dark:border-neutral-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                      {t.tasks.acceptanceCriteriaTitle} ({(selectedTask.acceptanceCriteria || []).filter((c) => c.satisfied).length}/{(selectedTask.acceptanceCriteria || []).length})
                    </h4>
                  </div>
                  <span className="text-2xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                    DoD
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  {(selectedTask.acceptanceCriteria || []).map((crit) => (
                    <div
                      key={crit.id}
                      className="group flex items-start justify-between gap-2.5 p-2 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors"
                    >
                      <div
                        onClick={() => handleToggleCriteria(selectedTask, crit.id)}
                        className="flex items-start gap-2.5 flex-1 cursor-pointer"
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-colors ${crit.satisfied ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-400 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-950'}`}>
                          {crit.satisfied && <Check className="w-3 h-3" />}
                        </div>
                        <span className={`text-xs ${crit.satisfied ? 'line-through text-slate-500 dark:text-neutral-500' : 'text-slate-700 dark:text-neutral-200'}`}>
                          {crit.text}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDrawerCriteria(crit.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 dark:text-neutral-500 hover:text-rose-400 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!selectedTask.acceptanceCriteria || selectedTask.acceptanceCriteria.length === 0) && (
                    <p className="text-2xs text-slate-500 dark:text-neutral-500 italic py-1">
                      {t.tasks.noCriteriaYet}
                    </p>
                  )}
                </div>

                <form onSubmit={handleAddDrawerCriteria} className="flex gap-2">
                  <input
                    type="text"
                    value={newDrawerCriteria}
                    onChange={(e) => setNewDrawerCriteria(e.target.value)}
                    placeholder={t.tasks.addCriterionPlaceholder}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!newDrawerCriteria.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 rounded-lg disabled:opacity-40"
                  >
                    + {t.tasks.addCriterion}
                  </button>
                </form>
              </div>

              {/* Subtasks Checklist */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200/80 dark:border-neutral-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                      {t.tasks.acceptanceSubtasks} ({(selectedTask.subtasks || []).filter((s) => s.completed).length}/{(selectedTask.subtasks || []).length})
                    </h4>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  {(selectedTask.subtasks || []).map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-start justify-between gap-2.5 p-2 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors"
                    >
                      <div
                        onClick={() => handleToggleSubtask(selectedTask, sub.id)}
                        className="flex items-start gap-2.5 flex-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-slate-300 dark:border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`text-xs ${
                            sub.completed ? 'line-through text-slate-500 dark:text-neutral-500' : 'text-slate-700 dark:text-neutral-200'
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDrawerSubtask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 dark:text-neutral-500 hover:text-rose-400 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                    <p className="text-2xs text-slate-500 dark:text-neutral-500 italic py-1">
                      {t.tasks.noSubtasksYet}
                    </p>
                  )}
                </div>

                <form onSubmit={handleAddDrawerSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newDrawerSubtask}
                    onChange={(e) => setNewDrawerSubtask(e.target.value)}
                    placeholder={t.tasks.addSubtaskPlaceholder}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!newDrawerSubtask.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 rounded-lg disabled:opacity-40"
                  >
                    + {t.tasks.addSubtask}
                  </button>
                </form>
              </div>

              {/* Comments Thread */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-3">
                  {t.tasks.discussionThread} ({comments.filter((c) => c.targetId === selectedTask.id).length})
                </h4>

                <div className="space-y-3 mb-4">
                  {comments
                    .filter((c) => c.targetId === selectedTask.id)
                    .map((cmt) => (
                      <div key={cmt.id} className="p-3 rounded-lg bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={cmt.author?.avatar}
                              name={cmt.author?.name || ''}
                              color={cmt.author?.color}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="font-semibold text-slate-700 dark:text-neutral-200">{cmt.author?.name}</span>
                          </div>
                          <span className="text-2xs text-slate-500 dark:text-neutral-500">
                            {new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-neutral-300 pl-7">{cmt.content}</p>
                      </div>
                    ))}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder={t.tasks.addComment}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    {t.tasks.postComment}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Tracking & Stopwatch Modal */}
      {timeTrackingTask && (
        <TimeTrackingModal
          task={timeTrackingTask}
          isOpen={!!timeTrackingTask}
          onClose={() => setTimeTrackingTask(null)}
        />
      )}

      {/* Export & Standup Generator Modal */}
      <ExportStandupModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Automations Modal */}
      <AutomationsModal
        isOpen={isAutomationsOpen}
        onClose={() => setIsAutomationsOpen(false)}
      />
    </div>
  );
}
