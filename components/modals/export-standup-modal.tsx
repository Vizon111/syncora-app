'use client';

import React, { useState, useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import {
  Download,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  FileCode,
  Calendar,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

interface ExportStandupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportStandupModal({ isOpen, onClose }: ExportStandupModalProps) {
  const { tasks, projects, sprints, documents, currentWorkspace, currentUser, t } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'standup' | 'csv' | 'json'>('standup');
  const [isCopied, setIsCopied] = useState(false);

  // Generate Daily Standup text in Markdown
  const standupMarkdown = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
    const urgentTasks = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done');

    let text = `### ☀️ Daily Standup — ${today}\n`;
    text += `**Команда / Воркспейс:** ${currentWorkspace.name}\n`;
    text += `**Автор отчета:** ${currentUser.name}\n\n`;

    text += `#### ✅ Что завершено:\n`;
    if (completedTasks.length === 0) {
      text += `- Нет завершенных задач за последнее время.\n`;
    } else {
      completedTasks.slice(0, 5).forEach((t) => {
        const prj = projects.find((p) => p.id === t.projectId)?.name || 'Проект';
        text += `- [${t.id}] **${t.title}** (${prj}) — *${t.assignee?.name || 'Без исполнителя'}*\n`;
      });
    }

    text += `\n#### ⚡ В работе сегодня:\n`;
    if (inProgressTasks.length === 0) {
      text += `- Задачи в процессе отсутствуют.\n`;
    } else {
      inProgressTasks.slice(0, 7).forEach((t) => {
        const prj = projects.find((p) => p.id === t.projectId)?.name || 'Проект';
        text += `- [${t.id}] **${t.title}** (${prj}) — *${t.assignee?.name || 'Без исполнителя'}* [${t.priority.toUpperCase()}]\n`;
      });
    }

    text += `\n#### 🚨 Блокеры и риски:\n`;
    if (urgentTasks.length === 0) {
      text += `- Блокеров нет, все задачи в плановом режиме.\n`;
    } else {
      urgentTasks.forEach((t) => {
        text += `- ⚠️ **P0 БЛОКЕР:** [${t.id}] ${t.title} (дедлайн: ${new Date(t.dueDate).toLocaleDateString()})\n`;
      });
    }

    return text;
  }, [tasks, projects, currentWorkspace, currentUser]);

  // Handle Copy Standup
  const handleCopyStandup = () => {
    navigator.clipboard.writeText(standupMarkdown);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Handle CSV Download
  const handleDownloadCsv = () => {
    const headers = [
      'Task ID',
      'Title',
      'Project',
      'Status',
      'Priority',
      'Assignee',
      'Due Date',
      'Story Points',
      'Logged Hours',
      'Remaining Hours',
    ];

    const rows = tasks.map((t) => {
      const prjName = projects.find((p) => p.id === t.projectId)?.name || '';
      return [
        `"${t.id}"`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(prjName || '').replace(/"/g, '""')}"`,
        `"${t.status}"`,
        `"${t.priority}"`,
        `"${(t.assignee?.name || '').replace(/"/g, '""')}"`,
        `"${t.dueDate || ''}"`,
        t.storyPoints ?? '',
        t.loggedHours ?? 0,
        (t.estimatedHours ?? 0) - (t.loggedHours ?? 0),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowspace_tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle JSON Download
  const handleDownloadJson = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workspace: currentWorkspace,
      projects,
      sprints,
      tasks,
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        emoji: d.emoji,
        rawText: d.rawText,
        updatedAt: d.updatedAt,
      })),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowspace_backup_${currentWorkspace.slug}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">{t.exportStandup.title}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">{t.exportStandup.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-3 border-b border-neutral-800/80 bg-neutral-950/40 text-xs">
          <button
            onClick={() => setActiveTab('standup')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'standup'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.exportStandup.tabStandup}</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'csv'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportStandup.tabCsv}</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'json'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{t.exportStandup.tabJson}</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
          {activeTab === 'standup' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  {t.exportStandup.preview}
                </span>
                <button
                  onClick={handleCopyStandup}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? t.exportStandup.copied : t.exportStandup.copyMarkdown}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-neutral-200 font-mono text-2xs whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">
                {standupMarkdown}
              </div>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-4 text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-neutral-200">
                Экспорт задач воркспейса в формате CSV
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                {t.exportStandup.csvDesc} Совместимо с Excel, Google Sheets, Notion и Jira.
              </p>
              <div className="text-2xs font-mono text-neutral-500">
                Всего задач для выгрузки: {tasks.length}
              </div>
              <button
                onClick={handleDownloadCsv}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/20 mx-auto"
              >
                <Download className="w-4 h-4" />
                <span>{t.exportStandup.downloadCsv}</span>
              </button>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <FileCode className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-neutral-200">
                Резервная копия структуры воркспейса (JSON)
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                {t.exportStandup.jsonDesc} Включает проекты, спринты, задачи и документы.
              </p>
              <div className="text-2xs font-mono text-neutral-500">
                {projects.length} проектов • {sprints.length} спринтов • {tasks.length} задач •{' '}
                {documents.length} документов
              </div>
              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/20 mx-auto"
              >
                <Download className="w-4 h-4" />
                <span>{t.exportStandup.downloadJson}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
