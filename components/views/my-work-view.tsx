'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { Task, TaskStatus } from '@/lib/types';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  Flame,
  AlertTriangle,
  ChevronDown,
  Timer,
  CheckSquare,
  Sparkles,
  ArrowRight,
  Plus,
  Coffee,
  Check,
} from 'lucide-react';

export function MyWorkView() {
  const {
    tasks,
    currentUser,
    projects,
    updateTask,
    logTaskWorkTime,
    setActiveView,
    t,
  } = useWorkspace();

  // Filter tasks assigned to current user
  const myTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.assignee?.id === currentUser.id || t.assignee?.name === currentUser.name
    );
  }, [tasks, currentUser]);

  // Pomodoro Timer State
  type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
  const [timerMode, setTimerMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [loggedNotification, setLoggedNotification] = useState<string | null>(null);

  // Derive selected task id without setting state inside an effect
  const effectiveSelectedTaskId =
    selectedTaskId ||
    (myTasks.find((t) => t.status === 'in_progress')?.id || myTasks[0]?.id || '');

  // Handle timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            // Completed session alert
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const handleSetMode = (mode: TimerMode) => {
    setTimerMode(mode);
    setIsRunning(false);
    if (mode === 'focus') setTimeLeft(25 * 60);
    else if (mode === 'shortBreak') setTimeLeft(5 * 60);
    else if (mode === 'longBreak') setTimeLeft(15 * 60);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    if (timerMode === 'focus') setTimeLeft(25 * 60);
    else if (timerMode === 'shortBreak') setTimeLeft(5 * 60);
    else if (timerMode === 'longBreak') setTimeLeft(15 * 60);
  };

  const selectedTask = myTasks.find((t) => t.id === effectiveSelectedTaskId);

  const handleLogTimerElapsed = async () => {
    if (!effectiveSelectedTaskId) return;
    const totalDuration =
      timerMode === 'focus' ? 25 * 60 : timerMode === 'shortBreak' ? 5 * 60 : 15 * 60;
    const elapsedSeconds = totalDuration - timeLeft;
    const hours = Math.max(0.25, Number((elapsedSeconds / 3600).toFixed(2)));

    await logTaskWorkTime(
      effectiveSelectedTaskId,
      hours,
      `Сессия Pomodoro (${timerMode}): ${Math.round(elapsedSeconds / 60)} мин.`
    );

    setLoggedNotification(`+${hours}ч залогировано в задачу «${selectedTask?.title}»`);
    setTimeout(() => setLoggedNotification(null), 3000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Grouped task categories
  const now = new Date();
  const urgentTasks = myTasks.filter((t) => {
    if (t.status === 'done') return false;
    const isUrgentPriority = t.priority === 'urgent';
    const dueDate = new Date(t.dueDate);
    const isDueSoon = (dueDate.getTime() - now.getTime()) / (1000 * 3600) <= 24;
    return isUrgentPriority || isDueSoon;
  });

  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress');
  const todoTasks = myTasks.filter((t) => t.status === 'todo');
  const reviewTasks = myTasks.filter((t) => t.status === 'review');
  const doneTasks = myTasks.filter((t) => t.status === 'done');

  // Total logged hours calculated from myTasks worklogs
  const totalHoursLogged = useMemo(() => {
    return myTasks.reduce((acc, t) => {
      const taskHours = (t.worklogs || []).reduce((wAcc, w) => wAcc + (w.hours || 0), 0);
      return acc + (taskHours || t.loggedHours || 0);
    }, 0);
  }, [myTasks]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await updateTask({
      ...task,
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto custom-scrollbar animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Avatar
            src={currentUser.avatar}
            name={currentUser.name}
            color={currentUser.color}
            className="w-12 h-12 rounded-2xl ring-2 ring-indigo-500/40 object-cover shadow-lg"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-2">
              <span>{t.myWorkView.title}</span>
              <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {currentUser.name}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{t.myWorkView.subtitle}</p>
          </div>
        </div>

        <button
          onClick={() => setActiveView('tasks')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:text-slate-800 dark:hover:text-neutral-100 transition-colors self-start sm:self-auto"
        >
          <span>{t.nav.tasks}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              {t.myWorkView.totalAssigned}
            </span>
            <div className="text-2xl font-bold text-slate-800 dark:text-neutral-100 mt-1">{myTasks.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              {t.myWorkView.inProgress}
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{inProgressTasks.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              {t.myWorkView.dueSoon}
            </span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{urgentTasks.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              {t.myWorkView.hoursLogged}
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{totalHoursLogged}ч</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Pomodoro Focus & Deep Work Interactive Widget */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-br from-slate-100 dark:from-neutral-900 via-slate-100 dark:via-neutral-900 to-indigo-950/30 border border-slate-200 dark:border-neutral-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Timer controls & mode tabs */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                  {t.myWorkView.pomodoroTitle}
                </h3>
              </div>

              {/* Mode Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200 dark:border-neutral-800 text-2xs">
                <button
                  onClick={() => handleSetMode('focus')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    timerMode === 'focus'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                  }`}
                >
                  {t.myWorkView.focusSession} (25m)
                </button>
                <button
                  onClick={() => handleSetMode('shortBreak')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    timerMode === 'shortBreak'
                      ? 'bg-emerald-600 text-white font-bold shadow'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                  }`}
                >
                  {t.myWorkView.shortBreak} (5m)
                </button>
                <button
                  onClick={() => handleSetMode('longBreak')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    timerMode === 'longBreak'
                      ? 'bg-teal-600 text-white font-bold shadow'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                  }`}
                >
                  {t.myWorkView.longBreak} (15m)
                </button>
              </div>
            </div>

            {/* Task selector for focus */}
            <div className="space-y-1.5">
              <label className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.myWorkView.focusingOn}</span>
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-xs text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
              >
                {myTasks.length === 0 ? (
                  <option value="">{t.myWorkView.noTaskSelected}</option>
                ) : (
                  myTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      [{task.status.toUpperCase()}] {task.title} (
                      {projects.find((p) => p.id === task.projectId)?.name || 'Проект'})
                    </option>
                  ))
                )}
              </select>
            </div>

            {loggedNotification && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loggedNotification}</span>
              </div>
            )}
          </div>

          {/* Right: Digital clock & actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-4 shrink-0 bg-slate-50/60 dark:bg-neutral-950/60 p-5 rounded-2xl border border-slate-200/80 dark:border-neutral-800/80">
            <div className="text-4xl md:text-5xl font-mono font-black tracking-widest text-slate-800 dark:text-neutral-100">
              {formatTimer(timeLeft)}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>{t.myWorkView.pauseTimer}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t.myWorkView.startTimer}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetTimer}
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
                title={t.myWorkView.resetTimer}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {selectedTaskId && (
                <button
                  onClick={handleLogTimerElapsed}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                  title={t.myWorkView.logTimeToTask}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.myWorkView.logTimeToTask}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Sections */}
      <div className="space-y-6">
        {/* Urgent & Deadlines */}
        {urgentTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {t.myWorkView.urgentSection} ({urgentTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {urgentTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projects={projects}
                  isSelectedForFocus={task.id === selectedTaskId}
                  onSelectForFocus={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          </div>
        )}

        {/* In Progress */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {t.myWorkView.inProgressSection} ({inProgressTasks.length})
            </h3>
          </div>
          {inProgressTasks.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-center text-xs text-slate-500 dark:text-neutral-500">
              {t.myWorkView.noTasksCategory}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inProgressTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projects={projects}
                  isSelectedForFocus={task.id === selectedTaskId}
                  onSelectForFocus={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          )}
        </div>

        {/* To Do */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <CheckSquare className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {t.myWorkView.todoSection} ({todoTasks.length})
            </h3>
          </div>
          {todoTasks.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-center text-xs text-slate-500 dark:text-neutral-500">
              {t.myWorkView.noTasksCategory}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todoTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projects={projects}
                  isSelectedForFocus={task.id === selectedTaskId}
                  onSelectForFocus={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Review */}
        {reviewTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                На проверке / Review ({reviewTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reviewTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projects={projects}
                  isSelectedForFocus={task.id === selectedTaskId}
                  onSelectForFocus={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently Done */}
        {doneTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {t.myWorkView.doneSection} ({doneTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {doneTasks.slice(0, 4).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projects={projects}
                  isSelectedForFocus={task.id === selectedTaskId}
                  onSelectForFocus={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  projects: any[];
  isSelectedForFocus: boolean;
  onSelectForFocus: () => void;
  onStatusChange: (status: TaskStatus) => void;
}

function TaskCard({
  task,
  projects,
  isSelectedForFocus,
  onSelectForFocus,
  onStatusChange,
}: TaskCardProps) {
  const project = projects.find((p) => p.id === task.projectId);
  const isDone = task.status === 'done';

  const priorityColor =
    task.priority === 'urgent'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      : task.priority === 'high'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-slate-300 dark:border-neutral-700';

  return (
    <div
      className={`p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border transition-all ${
        isSelectedForFocus
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
          : 'border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400">
              {task.id.slice(-6)}
            </span>
            <span
              className={`text-3xs font-semibold px-2 py-0.5 rounded-full border ${priorityColor}`}
            >
              {task.priority.toUpperCase()}
            </span>
            {project && (
              <span className="text-3xs text-slate-500 dark:text-neutral-400 font-medium truncate max-w-[120px]">
                {project.name}
              </span>
            )}
          </div>

          <h4
            className={`text-sm font-bold leading-snug line-clamp-2 ${
              isDone ? 'line-through text-slate-500 dark:text-neutral-500' : 'text-slate-800 dark:text-neutral-100'
            }`}
          >
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 line-clamp-1">{task.description}</p>
          )}

          {/* Subtasks progress */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-neutral-500 mb-1">
                <span>Подзадачи</span>
                <span>
                  {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length}
                </span>
              </div>
              <div className="w-full h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{
                    width: `${
                      (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick status selector */}
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          className="text-2xs font-semibold px-2 py-1 rounded-lg bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 focus:outline-none focus:border-indigo-500 shrink-0"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Footer info & Pomodoro target button */}
      <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-500 dark:text-neutral-400">
            <Clock className="w-3 h-3 text-slate-500 dark:text-neutral-500" />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </span>
          {task.storyPoints !== undefined && (
            <span className="font-mono text-3xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
              {task.storyPoints} SP
            </span>
          )}
        </div>

        <button
          onClick={onSelectForFocus}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-medium transition-colors ${
            isSelectedForFocus
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Timer className="w-3 h-3" />
          <span>{isSelectedForFocus ? 'В фокусе' : 'Выбрать для фокуса'}</span>
        </button>
      </div>
    </div>
  );
}
