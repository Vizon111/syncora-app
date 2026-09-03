'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { AppNotification } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  FileText,
  CheckSquare,
  Sparkles,
  ExternalLink,
  X,
  PlusCircle,
} from 'lucide-react';

export function NotificationsPopover() {
  const { tasks, currentUser, t, setActiveView, setSelectedDocId } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'deadlines' | 'mentions'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dynamic notifications state with localStorage persistence
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('flowspace_notifications');
      if (saved) return JSON.parse(saved);
    } catch {}

    // Default seeded notifications
    return [
      {
        id: 'notif_1',
        type: 'deadline',
        title: 'Срок задачи истекает сегодня',
        message: 'Задача «Оптимизация бандла и cold-start» должна быть завершена сегодня до 18:00',
        targetType: 'task',
        targetId: 'task_perf_coldstart',
        view: 'tasks',
        read: false,
        urgent: true,
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif_2',
        type: 'assignment',
        title: 'Вам назначена новая задача',
        message: 'Elena Rostova назначила вам задачу «Синхронизация CRDT курсоров»',
        targetType: 'task',
        targetId: 'task_crdt_cursors',
        view: 'tasks',
        read: false,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'notif_3',
        type: 'comment',
        title: 'Новый комментарий в документе',
        message: 'Marcus Vance: «Обратите внимание на таймауты SSE в PRD архитектуры»',
        targetType: 'document',
        targetId: 'doc_prd_core',
        view: 'documents',
        read: true,
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      },
      {
        id: 'notif_4',
        type: 'sprint',
        title: 'Рекомендация AI-спринта',
        message: 'Sprint 24 завершен на 72%. AI рекомендует скорректировать скоуп на +4 SP.',
        targetType: 'sprint',
        targetId: 'spr_active_24',
        view: 'sprints',
        read: true,
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      },
    ];
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('flowspace_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Dynamically derive deadline notifications from actual tasks without setState in effect
  const allNotifications = useMemo(() => {
    const urgentTasks = tasks.filter((task) => {
      if (task.status === 'done') return false;
      const dueDate = new Date(task.dueDate);
      const diffHours = (dueDate.getTime() - currentTime) / (1000 * 3600);
      return diffHours <= 24; // due within 24h or overdue
    });

    const dynamicDeadlines: AppNotification[] = urgentTasks
      .filter((tTask) => !notifications.some((n) => n.targetId === tTask.id))
      .map((tTask) => ({
        id: `notif_due_${tTask.id}`,
        type: 'deadline' as const,
        title: `${tTask.priority === 'urgent' ? '🚨 P0 Блокер' : '⏰ Срок задачи'}: ${tTask.title}`,
        message: `Дедлайн: ${new Date(tTask.dueDate).toLocaleDateString()}. Исполнитель: ${tTask.assignee?.name || 'Не назначен'}.`,
        targetType: 'task' as const,
        targetId: tTask.id,
        view: 'tasks' as const,
        read: false,
        urgent: true,
        createdAt: tTask.dueDate,
      }));

    return [...dynamicDeadlines, ...notifications];
  }, [tasks, notifications, currentTime]);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = allNotifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'deadlines') return n.type === 'deadline';
      if (filter === 'mentions') return n.type === 'assignment' || n.type === 'mention';
      return true;
    });
  }, [allNotifications, filter]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (n: AppNotification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
    );

    // Navigate to target view
    if (n.view) {
      setActiveView(n.view);
    }
    if (n.targetType === 'document' && n.targetId) {
      setSelectedDocId(n.targetId);
    }
    setIsOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSimulateAlert = () => {
    const simNotif: AppNotification = {
      id: `notif_sim_${Date.now()}`,
      type: 'mention',
      title: 'Упоминание от Alex Mercer',
      message: '«@' + currentUser.name + ', пожалуйста, посмотри ретроспективу спринта перед стендапом»',
      targetType: 'sprint',
      view: 'sprints',
      read: false,
      urgent: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [simNotif, ...prev]);
  };

  const formatTimeAgo = (iso: string) => {
    if (!currentTime) return '';
    const diff = Math.max(0, Math.floor((currentTime - new Date(iso).getTime()) / 1000));
    if (diff < 60) return t.notifications.justNow;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} мин.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t.notifications.hoursAgo}`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        id="btn-notifications-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
        title={t.notifications.title}
        aria-label={t.notifications.title}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-slate-50 dark:ring-neutral-950 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-neutral-900/95 border border-slate-200 dark:border-neutral-800 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                {t.notifications.title}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {unreadCount} {t.notifications.unread.toLowerCase()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs text-indigo-300 hover:bg-indigo-950/60 transition-colors"
                  title={t.notifications.markAllRead}
                >
                  <CheckCheck className="w-3 h-3" />
                  <span className="hidden sm:inline">{t.notifications.markAllRead}</span>
                </button>
              )}
              <button
                onClick={handleSimulateAlert}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                title={t.notifications.simulateBtn}
              >
                <PlusCircle className="w-3 h-3 text-indigo-400" />
                <span className="hidden sm:inline">{t.notifications.simulateBtn}</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-slate-200/80 dark:border-neutral-800/80 bg-slate-50/40 dark:bg-neutral-950/40 text-2xs overflow-x-auto custom-scrollbar">
            {(['all', 'unread', 'deadlines', 'mentions'] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setFilter(tabKey)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filter === tabKey
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100/60 dark:hover:bg-neutral-800/60'
                }`}
              >
                {t.notifications[tabKey]}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/60 dark:divide-neutral-800/60 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCheck className="w-8 h-8 text-slate-600 dark:text-neutral-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t.notifications.empty}</p>
                <p className="text-3xs text-slate-500 dark:text-neutral-500 mt-1">{t.notifications.emptySub}</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isUrgent = n.urgent || n.type === 'deadline';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 text-left transition-colors cursor-pointer group flex items-start justify-between gap-3 ${
                      !n.read
                        ? 'bg-indigo-950/20 hover:bg-indigo-950/40'
                        : 'hover:bg-slate-100 dark:hover:bg-neutral-850/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isUrgent
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : n.type === 'assignment'
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : n.type === 'comment'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isUrgent ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : n.type === 'assignment' ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : n.type === 'comment' ? (
                          <FileText className="w-3.5 h-3.5" />
                        ) : n.type === 'sprint' ? (
                          <Sparkles className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs font-semibold truncate ${
                              !n.read ? 'text-slate-800 dark:text-neutral-100' : 'text-slate-600 dark:text-neutral-300'
                            }`}
                          >
                            {n.title}
                          </h4>
                          <span className="text-3xs text-slate-500 dark:text-neutral-500 whitespace-nowrap">
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-2xs text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500" title="Не прочитано" />
                      )}
                      <button
                        onClick={(e) => handleDismiss(e, n.id)}
                        className="p-1 rounded text-slate-600 dark:text-neutral-300 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer quick action */}
          <div className="p-2 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-950/60 flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400">
            <span className="text-3xs text-slate-500 dark:text-neutral-500 font-mono">
              {notifications.length} событий
            </span>
            <button
              onClick={() => {
                setActiveView('overview');
                setIsOpen(false);
              }}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <span>Лента активности</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
