'use client';

import React, { useState, useEffect } from 'react';
import { Task, WorklogItem } from '@/lib/types';
import { useWorkspace } from '@/hooks/use-workspace-context';
import {
  Clock,
  Play,
  Square,
  Plus,
  Trash2,
  X,
  User as UserIcon,
  Calendar,
  CheckCircle2,
  Flame,
} from 'lucide-react';

interface TimeTrackingModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TimeTrackingModal({ task, isOpen, onClose }: TimeTrackingModalProps) {
  const { t, currentUser, logTaskWorkTime, deleteTaskWorklog } = useWorkspace();

  const [hoursInput, setHoursInput] = useState<string>('1');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Timer Stopwatch State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStopAndFill = () => {
    setIsTimerRunning(false);
    const calculatedHours = Math.max(0.1, Number((elapsedSeconds / 3600).toFixed(2)));
    setHoursInput(calculatedHours.toString());
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(hoursInput);
    if (isNaN(h) || h <= 0) return;

    setIsSubmitting(true);
    await logTaskWorkTime(task.id, h, descriptionInput || 'General implementation & bugfixes');
    setIsSubmitting(false);
    setDescriptionInput('');
    setHoursInput('1');
    setElapsedSeconds(0);
    setIsTimerRunning(false);
  };

  const handleDeleteLog = async (worklogId: string) => {
    await deleteTaskWorklog(task.id, worklogId);
  };

  const totalLogged = task.loggedHours || 0;
  const estimated = task.estimatedHours || 0;
  const remaining = Math.max(0, Number((estimated - totalLogged).toFixed(2)));
  const progressPercent = estimated > 0 ? Math.min(100, Math.round((totalLogged / estimated) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.tasks.timeTracking}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {task.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress & Estimates Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t.tasks.loggedHours}
                </span>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                  {totalLogged}h
                </p>
              </div>
              <div className="border-x border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t.tasks.estimatedHours}
                </span>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {estimated > 0 ? `${estimated}h` : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t.tasks.remainingHours}
                </span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {estimated > 0 ? `${remaining}h` : '—'}
                </p>
              </div>
            </div>

            {estimated > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Прогресс бюджета времени</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      progressPercent > 100
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Stopwatch Timer */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200/60 dark:border-violet-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isTimerRunning ? 'bg-red-500 animate-ping' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Живой таймер выполнения
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Запустите таймер во время работы над задачей
                  </p>
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatTimer(elapsedSeconds)}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              {!isTimerRunning ? (
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {t.tasks.startTimer}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopAndFill}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  {t.tasks.stopTimer}
                </button>
              )}

              {elapsedSeconds > 0 && !isTimerRunning && (
                <button
                  type="button"
                  onClick={() => setElapsedSeconds(0)}
                  className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Log Time Form */}
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-500" />
              {t.tasks.logTimeModalTitle}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.tasks.loggedHours} *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  max="100"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Описание работ
                </label>
                <input
                  type="text"
                  placeholder={t.tasks.worklogDescPlaceholder}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-violet-600 dark:hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
              >
                {isSubmitting ? t.common.loading : t.tasks.logTimeBtn}
              </button>
            </div>
          </form>

          {/* Worklog History List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>{t.tasks.worklogs}</span>
              <span className="text-xs text-slate-400 font-normal">
                {task.worklogs?.length || 0} записей
              </span>
            </h3>

            {(!task.worklogs || task.worklogs.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center italic">
                {t.tasks.noWorklogs}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {task.worklogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.hours}h
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            • {log.user?.name || currentUser.name}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            • {new Date(log.loggedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          {log.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteLog(log.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all ml-2"
                      title="Удалить запись"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
