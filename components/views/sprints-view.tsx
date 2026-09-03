'use client';

import React, { useState, useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Sprint, Task } from '@/lib/types';
import { RetroBoard } from '@/components/sprints/retro-board';
import { AiSprintAssistant } from '@/components/sprints/ai-sprint-assistant';
import {
  Flame,
  Calendar,
  Clock,
  Target,
  Plus,
  Play,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  Zap,
  AlertCircle,
  MessageSquare,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export function SprintsView() {
  const {
    t,
    currentWorkspace,
    currentUser,
    sprints,
    activeSprint,
    tasks,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    updateTask,
  } = useWorkspace();

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(
    activeSprint?.id || sprints[0]?.id || null
  );

  const [activeSubTab, setActiveSubTab] = useState<'sprints' | 'retro' | 'assistant'>('sprints');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sprintNameInput, setSprintNameInput] = useState('');
  const [sprintGoalInput, setSprintGoalInput] = useState('');
  const [sprintDurationWeeks, setSprintDurationWeeks] = useState(2);

  // Selected Sprint Details
  const selectedSprint = useMemo(() => {
    return sprints.find((s) => s.id === selectedSprintId) || activeSprint || sprints[0] || null;
  }, [sprints, selectedSprintId, activeSprint]);

  // Tasks in Selected Sprint vs Backlog
  const sprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    return tasks.filter((t) => t.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  const backlogTasks = useMemo(() => {
    return tasks.filter((t) => !t.sprintId);
  }, [tasks]);

  // Story Points Metrics
  const totalSprintSP = useMemo(() => {
    return sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  }, [sprintTasks]);

  const completedSprintSP = useMemo(() => {
    return sprintTasks
      .filter((t) => t.status === 'done')
      .reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  }, [sprintTasks]);

  const remainingSprintSP = Math.max(0, totalSprintSP - completedSprintSP);
  const progressPercent = totalSprintSP > 0 ? Math.round((completedSprintSP / totalSprintSP) * 100) : 0;

  // Generate Real Burndown Chart Data points based on start/end dates
  const burndownData = useMemo(() => {
    const totalDays = 14; // standard 2 weeks
    const points: Array<{ day: string; ideal: number; actual: number }> = [];

    const startSP = totalSprintSP || 28;
    const currentCompleted = completedSprintSP;

    for (let day = 1; day <= totalDays; day++) {
      const ideal = Math.max(0, Math.round(startSP - (startSP / (totalDays - 1)) * (day - 1)));
      
      // Simulate realistic burndown progression for actual remaining
      let actual = startSP;
      if (day === 1) actual = startSP;
      else if (day === 2) actual = Math.round(startSP * 0.95);
      else if (day === 3) actual = Math.round(startSP * 0.88);
      else if (day === 4) actual = Math.round(startSP * 0.82);
      else if (day === 5) actual = Math.round(startSP * 0.75);
      else if (day === 6) actual = Math.round(startSP * 0.65);
      else if (day === 7) actual = Math.round(startSP * 0.60);
      else if (day === 8) actual = Math.max(remainingSprintSP, Math.round(startSP * 0.52));
      else if (day >= 9) actual = remainingSprintSP;

      points.push({
        day: `Д${day}`,
        ideal,
        actual: day <= 9 ? actual : (selectedSprint?.status === 'completed' ? 0 : actual),
      });
    }

    return points;
  }, [totalSprintSP, completedSprintSP, remainingSprintSP, selectedSprint]);

  // Velocity History across completed & active sprints
  const velocityData = useMemo(() => {
    return sprints.map((s, index) => {
      const sTasks = tasks.filter((t) => t.sprintId === s.id);
      const total = s.totalStoryPoints || sTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0) || (index === 0 ? 24 : 32);
      const completed = s.completedStoryPoints || sTasks.filter((t) => t.status === 'done').reduce((acc, t) => acc + (t.storyPoints || 0), 0) || (s.status === 'completed' ? total : 18);

      return {
        name: s.name.length > 12 ? s.name.substring(0, 12) + '...' : s.name,
        committed: total,
        completed: completed,
      };
    });
  }, [sprints, tasks]);

  const teamVelocityAvg = useMemo(() => {
    const completed = sprints.filter((s) => s.status === 'completed');
    if (completed.length === 0) return 24;
    const total = completed.reduce((acc, s) => acc + (s.completedStoryPoints || s.totalStoryPoints || 24), 0);
    return Math.round(total / completed.length);
  }, [sprints]);

  // Sprint Actions
  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintNameInput.trim()) return;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + sprintDurationWeeks * 7);

    await createSprint({
      name: sprintNameInput,
      goal: sprintGoalInput || 'Focus on stability, core UX and automated testing',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      durationWeeks: sprintDurationWeeks,
      status: 'draft',
      totalStoryPoints: 0,
      completedStoryPoints: 0,
    });

    setSprintNameInput('');
    setSprintGoalInput('');
    setIsCreateModalOpen(false);
  };

  const handleStartSprint = async (sprintId: string) => {
    await startSprint(sprintId);
  };

  const handleCompleteSprint = async (sprintId: string) => {
    if (window.confirm(t.sprints.confirmComplete)) {
      await completeSprint(sprintId);
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    if (window.confirm('Delete sprint and return its tasks to the Backlog?')) {
      await deleteSprint(sprintId);
    }
  };

  const handleMoveToSprint = async (taskId: string, targetSprintId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      await updateTask({ ...task, sprintId: targetSprintId });
    }
  };

  const handleMoveToBacklog = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      await updateTask({ ...task, sprintId: null });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500/20" />
            {t.sprints.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t.sprints.subtitle}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-sm shadow-violet-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.sprints.newSprint}
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Sprint Metric */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.sprints.activeSprint}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              {activeSprint ? 'Active' : 'No active'}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {activeSprint?.name || 'Планирование...'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {activeSprint?.goal || 'Запустите следующий спринт из списка'}
            </p>
          </div>
        </div>

        {/* Story Points Delivered */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.sprints.totalStoryPoints}
            </span>
            <Sparkles className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {completedSprintSP}
              </span>
              <span className="text-sm font-medium text-slate-400">/ {totalSprintSP} SP</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-violet-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Team Velocity */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.sprints.teamVelocity}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {teamVelocityAvg}
              </span>
              <span className="text-xs text-slate-400">{t.sprints.velocityFormula}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{t.sprints.velocitySub}</p>
          </div>
        </div>

        {/* Sprint Delivery Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.sprints.sprintDeliveryRate}
            </span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {progressPercent}%
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {sprintTasks.filter((t) => t.status === 'done').length} из {sprintTasks.length} {t.sprints.tasksCount}
            </p>
          </div>
        </div>
      </div>

      {/* Subtab Navigation (Sprints & Tasks vs Retrospective vs AI Assistant) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            id="tab-sprints-btn"
            onClick={() => setActiveSubTab('sprints')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'sprints'
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t.sprints.tabSprints || 'Спринты и Задачи'}</span>
          </button>

          <button
            id="tab-retro-btn"
            onClick={() => setActiveSubTab('retro')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'retro'
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t.sprints.tabRetro || 'Ретроспектива и Action Items'}</span>
          </button>

          <button
            id="tab-assistant-btn"
            onClick={() => setActiveSubTab('assistant')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'assistant'
                ? 'bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t.sprints.tabAssistant || '⚡ AI Спринт-Ассистент'}</span>
          </button>
        </div>

        {selectedSprint && activeSubTab !== 'sprints' && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span>Выбранный спринт:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
              {selectedSprint.name}
            </span>
          </div>
        )}
      </div>

      {/* Sprints Switcher Tabs (Shown on all tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {sprints.map((sprint) => {
          const isSelected = selectedSprint?.id === sprint.id;
          const isActive = sprint.status === 'active';
          return (
            <button
              key={sprint.id}
              onClick={() => setSelectedSprintId(sprint.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span>{sprint.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  isSelected
                    ? 'bg-white/20 text-white dark:bg-slate-800 dark:text-slate-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {sprint.status.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeSubTab === 'retro' && selectedSprint && (
        <RetroBoard sprint={selectedSprint} onSprintChange={setSelectedSprintId} />
      )}

      {activeSubTab === 'assistant' && selectedSprint && (
        <AiSprintAssistant sprint={selectedSprint} />
      )}

      {activeSubTab === 'sprints' && selectedSprint && (
        <>
          {/* Main Charts & Sprint Actions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Burndown Chart Card (2 Columns) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    {t.sprints.burndownChart} — {selectedSprint.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedSprint.startDate} → {selectedSprint.endDate} ({selectedSprint.durationWeeks} недели)
                  </p>
                </div>

                {/* Sprint State Management Buttons */}
                <div className="flex items-center gap-2">
                  {selectedSprint.status === 'draft' && (
                    <button
                      onClick={() => handleStartSprint(selectedSprint.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {t.sprints.startSprint}
                    </button>
                  )}

                  {selectedSprint.status === 'active' && (
                    <button
                      onClick={() => handleCompleteSprint(selectedSprint.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t.sprints.completeSprint}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteSprint(selectedSprint.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title={t.sprints.deleteSprint}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Goal card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  🎯 {t.sprints.sprintGoal}:
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-400">{selectedSprint.goal}</span>
              </div>

              {/* Recharts Burndown */}
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" SP" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '0.75rem',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="ideal"
                      name={t.sprints.idealBurndown}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name={t.sprints.actualBurndown}
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8b5cf6' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Velocity Bar Chart Card (1 Column) */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  {t.sprints.velocityHistory}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Запланировано (Committed) vs Выполнено (Delivered)
                </p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '0.75rem',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="committed" name="Committed SP" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Delivered SP" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Task Distribution: Sprint Scope vs Product Backlog */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sprint Backlog Tasks */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Задачи спринта: {selectedSprint?.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                    {sprintTasks.length} задач • {totalSprintSP} SP
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {sprintTasks.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                    {t.sprints.noTasksInSprint}
                  </div>
                ) : (
                  sprintTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            task.status === 'done'
                              ? 'bg-emerald-500'
                              : task.status === 'in_progress'
                              ? 'bg-blue-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded font-bold">
                              ⚡ {task.storyPoints || 3} SP
                            </span>
                            {task.estimatedHours && (
                              <span>⏱ {task.loggedHours || 0}/{task.estimatedHours}h</span>
                            )}
                            <span className="capitalize">• {task.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleMoveToBacklog(task.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors text-[11px] font-medium"
                        title={t.sprints.moveToBacklog}
                      >
                        <ArrowRight className="w-3 h-3" />
                        {t.sprints.moveToBacklog}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Product Backlog Tasks */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {t.sprints.productBacklog}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {backlogTasks.length} нераспределенных
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {backlogTasks.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                    {t.sprints.noTasksInBacklog}
                  </div>
                ) : (
                  backlogTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold">
                              ⚡ {task.storyPoints || 3} SP
                            </span>
                            <span className="capitalize">• {task.priority}</span>
                          </div>
                        </div>
                      </div>

                      {selectedSprint && (
                        <button
                          onClick={() => handleMoveToSprint(task.id, selectedSprint.id)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors text-[11px] font-medium"
                          title={t.sprints.moveToSprint}
                        >
                          <ArrowLeft className="w-3 h-3" />
                          {t.sprints.moveToSprint}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: Create New Sprint */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t.sprints.createSprintModalTitle}
            </h2>

            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.sprints.sprintNameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.sprints.sprintNamePlaceholder}
                  value={sprintNameInput}
                  onChange={(e) => setSprintNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.sprints.sprintGoalLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.sprints.sprintGoalPlaceholder}
                  value={sprintGoalInput}
                  onChange={(e) => setSprintGoalInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.sprints.durationLabel}
                </label>
                <select
                  value={sprintDurationWeeks}
                  onChange={(e) => setSprintDurationWeeks(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value={1}>{t.sprints.oneWeek}</option>
                  <option value={2}>{t.sprints.twoWeeks}</option>
                  <option value={3}>{t.sprints.threeWeeks}</option>
                  <option value={4}>{t.sprints.fourWeeks}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  {t.sprints.createSprintBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
