'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { RetroItem, RetroCategory, Sprint, SprintRetroSummary } from '@/lib/types';
import {
  Sparkles,
  Plus,
  ThumbsUp,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Heart,
  Target,
  FileText,
  Trash2,
  UserCheck,
  Calendar,
  Layers,
  ChevronDown,
  Loader2,
  Check,
  TrendingUp,
  Share2,
} from 'lucide-react';

interface RetroBoardProps {
  sprint: Sprint;
  onSprintChange?: (sprintId: string) => void;
}

const CATEGORY_CONFIG: Record<
  RetroCategory,
  {
    titleKey: string;
    icon: React.ElementType;
    bgHeader: string;
    textColor: string;
    borderColor: string;
    cardBorder: string;
    cardBg: string;
    accentBg: string;
  }
> = {
  went_well: {
    titleKey: 'retroWentWell',
    icon: CheckCircle2,
    bgHeader: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    cardBorder: 'border-emerald-100 hover:border-emerald-300',
    cardBg: 'bg-emerald-50/30',
    accentBg: 'bg-emerald-500',
  },
  to_improve: {
    titleKey: 'retroToImprove',
    icon: AlertTriangle,
    bgHeader: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    cardBorder: 'border-amber-100 hover:border-amber-300',
    cardBg: 'bg-amber-50/30',
    accentBg: 'bg-amber-500',
  },
  insight: {
    titleKey: 'retroInsights',
    icon: Lightbulb,
    bgHeader: 'bg-blue-50 text-blue-900 border-blue-200',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    cardBorder: 'border-blue-100 hover:border-blue-300',
    cardBg: 'bg-blue-50/30',
    accentBg: 'bg-blue-500',
  },
  action_item: {
    titleKey: 'retroActionItems',
    icon: Target,
    bgHeader: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    cardBorder: 'border-indigo-100 hover:border-indigo-300',
    cardBg: 'bg-indigo-50/30',
    accentBg: 'bg-indigo-500',
  },
  kudos: {
    titleKey: 'retroKudos',
    icon: Heart,
    bgHeader: 'bg-rose-50 text-rose-900 border-rose-200',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    cardBorder: 'border-rose-100 hover:border-rose-300',
    cardBg: 'bg-rose-50/30',
    accentBg: 'bg-rose-500',
  },
};

const getDefaultDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

export function RetroBoard({ sprint, onSprintChange }: RetroBoardProps) {
  const {
    t,
    currentUser,
    allUsers,
    sprints,
    fetchRetroItems,
    createRetroItem,
    voteRetroItem,
    deleteRetroItem,
    convertRetroActionToTask,
    generateAiRetrospective,
  } = useWorkspace();

  const [items, setItems] = useState<RetroItem[]>([]);
  const [summary, setSummary] = useState<SprintRetroSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New item modal/inline state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<RetroCategory>('went_well');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState(currentUser.id);
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [newDueDate, setNewDueDate] = useState(getDefaultDueDate);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiFocusArea, setAiFocusArea] = useState('');
  const [saveAsDoc, setSaveAsDoc] = useState(true);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Converting action item state
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchSprintRetro = async () => {
      const data = await fetchRetroItems(sprint.id);
      if (!isCancelled) {
        setItems(data.items);
        setSummary(data.summary);
      }
    };
    fetchSprintRetro();
    return () => {
      isCancelled = true;
    };
  }, [sprint.id, fetchRetroItems]);

  const handleVote = async (itemId: string) => {
    const updated = await voteRetroItem(sprint.id, itemId);
    if (updated) {
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
    }
  };

  const handleDelete = async (itemId: string) => {
    const ok = await deleteRetroItem(sprint.id, itemId);
    if (ok) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    const assignee = allUsers.find((u) => u.id === newAssigneeId);

    const created = await createRetroItem(sprint.id, {
      category: newCategory,
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: newCategory === 'action_item' ? 'pending' : undefined,
      assigneeId: newCategory === 'action_item' ? newAssigneeId : undefined,
      assigneeName: newCategory === 'action_item' ? assignee?.name : undefined,
      priority: newCategory === 'action_item' ? newPriority : undefined,
      dueDate: newCategory === 'action_item' ? newDueDate : undefined,
    });

    if (created) {
      setItems((prev) => [created, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setIsAddModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleConvertToTask = async (item: RetroItem) => {
    setConvertingId(item.id);
    const result = await convertRetroActionToTask(sprint.id, item.id, sprint.id);
    if (result) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? result.retroItem : it)));
    }
    setConvertingId(null);
  };

  const handleRunAiRetro = async () => {
    setIsAiGenerating(true);
    setAiSuccessMessage(null);

    const res = await generateAiRetrospective(sprint.id, aiFocusArea, saveAsDoc);
    if (res) {
      setSummary(res.summary);
      // Reload items to merge newly created AI cards
      const data = await fetchRetroItems(sprint.id);
      setItems(data.items);

      setAiSuccessMessage(
        saveAsDoc
          ? (t.sprints.savedToDocsSuccess || 'Ретроспектива сохранена в Документы!')
          : 'AI ретроспектива успешно сгенерирована!'
      );
      setTimeout(() => {
        setIsAiModalOpen(false);
        setAiSuccessMessage(null);
      }, 1500);
    }
    setIsAiGenerating(false);
  };

  const categories: RetroCategory[] = ['went_well', 'to_improve', 'insight', 'action_item', 'kudos'];

  const actionItems = items.filter((i) => i.category === 'action_item');
  const convertedActionItems = actionItems.filter((i) => i.status === 'converted_to_task');

  return (
    <div className="flex flex-col gap-6" id="retro-board-container">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 dark:border-neutral-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-50">
                {t.sprints.retroTitle || 'Командная ретроспектива'}
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 rounded-full border border-slate-200 dark:border-neutral-800">
                {sprint.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-500 mt-0.5">
              {t.sprints.retroSubtitle ||
                'Сбор обратной связи, голосование за идеи и автоматическая генерация Action Items с AI'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sprint Switcher Dropdown */}
          {sprints.length > 1 && onSprintChange && (
            <div className="relative">
              <select
                value={sprint.id}
                onChange={(e) => onSprintChange(e.target.value)}
                className="text-xs font-medium bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 focus:outline-hidden cursor-pointer"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="open-add-retro-card-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.sprints.addRetroCard || 'Добавить карточку'}</span>
          </button>

          <button
            id="open-ai-retro-generator-btn"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg shadow-xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.sprints.generateAiRetroBtn || 'Сгенерировать AI-ретроспективу'}</span>
          </button>
        </div>
      </div>

      {/* AI Summary Banner (if generated) */}
      {summary && (
        <div className="bg-linear-to-r from-indigo-50/80 via-white to-violet-50/80 border border-indigo-100 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-100/60">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-xs flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>{summary.healthScore}/100</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                  {t.sprints.aiSummary || 'Аналитическое резюме AI'}
                </span>
                <p className="text-xs text-slate-700 dark:text-neutral-200 font-medium mt-0.5 max-w-2xl leading-relaxed">
                  {summary.aiSummary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-neutral-300">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 dark:border-neutral-800">
                <span className="font-semibold text-slate-900 dark:text-neutral-50">
                  {summary.velocityAnalysis?.completedSP || 0}/{summary.velocityAnalysis?.committedSP || 0} SP
                </span>
                <span className="text-slate-500 dark:text-neutral-400">
                  ({summary.velocityAnalysis?.completionRatePct || 0}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-500">Action Items:</span>
                <span className="font-semibold text-indigo-600">
                  {convertedActionItems.length}/{actionItems.length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Recommendations & Achievements Chips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
            {summary.topAchievements?.length > 0 && (
              <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
                <span className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Ключевые успехи спринта
                </span>
                <ul className="space-y-1 text-slate-600 dark:text-neutral-300 pl-4 list-disc">
                  {summary.topAchievements.slice(0, 2).map((ach, idx) => (
                    <li key={idx}>{ach}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.recommendations?.length > 0 && (
              <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
                <span className="font-semibold text-indigo-800 flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                  Рекомендации на следующий спринт
                </span>
                <ul className="space-y-1 text-slate-600 dark:text-neutral-300 pl-4 list-disc">
                  {summary.recommendations.slice(0, 2).map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5-Column Retrospective Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {categories.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const Icon = config.icon;
          const categoryItems = items.filter((i) => i.category === category);
          const localizedTitle =
            (t.sprints as any)[config.titleKey] || category.replace('_', ' ').toUpperCase();

          return (
            <div
              key={category}
              className="flex flex-col bg-slate-50/70 dark:bg-neutral-900/70 rounded-xl border border-slate-200/80 dark:border-neutral-800/80 p-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border font-medium text-xs mb-3 shadow-2xs ${config.bgHeader}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{localizedTitle}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-md bg-white/80 text-[11px] font-bold text-slate-700 dark:text-neutral-200">
                  {categoryItems.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                {categoryItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-neutral-400 border border-dashed border-slate-200 dark:border-neutral-800 rounded-lg flex-1 bg-white/40">
                    <p className="text-xs">Нет записей</p>
                    <button
                      onClick={() => {
                        setNewCategory(category);
                        setIsAddModalOpen(true);
                      }}
                      className="mt-2 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Добавить
                    </button>
                  </div>
                ) : (
                  categoryItems.map((item) => {
                    const hasVoted = (item.votedUserIds || []).includes(currentUser.id);
                    const isActionItem = item.category === 'action_item';
                    const isConverted = item.status === 'converted_to_task';

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl p-3.5 border shadow-2xs transition-all flex flex-col justify-between gap-2.5 ${config.cardBorder}`}
                      >
                        <div>
                          {/* Priority / Status tags for action items */}
                          {isActionItem && (
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                  item.priority === 'urgent'
                                    ? 'bg-rose-100 text-rose-700'
                                    : item.priority === 'high'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {item.priority || 'high'}
                              </span>

                              {isConverted ? (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <Check className="w-3 h-3" /> В тасках
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-500">
                                  Action Plan
                                </span>
                              )}
                            </div>
                          )}

                          <h4 className="text-xs font-semibold text-slate-900 dark:text-neutral-50 leading-snug">
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-[11px] text-slate-600 dark:text-neutral-300 mt-1 leading-relaxed whitespace-pre-line">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Assignee and Due Date for Action Items */}
                        {isActionItem && (item.assigneeName || item.dueDate) && (
                          <div className="pt-2 border-t border-slate-100 dark:border-neutral-900 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-500">
                            {item.assigneeName && (
                              <div className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-indigo-500" />
                                <span className="truncate max-w-[90px]">{item.assigneeName}</span>
                              </div>
                            )}
                            {item.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500 dark:text-neutral-400" />
                                <span>{item.dueDate}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Convert to Task CTA button */}
                        {isActionItem && !isConverted && (
                          <button
                            id={`convert-retro-task-${item.id}`}
                            onClick={() => handleConvertToTask(item)}
                            disabled={convertingId === item.id}
                            className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px] rounded-lg transition-colors"
                          >
                            {convertingId === item.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3 h-3" />
                            )}
                            <span>{t.sprints.convertToTask || 'Создать задачу'}</span>
                          </button>
                        )}

                        {/* Footer: Author & Vote button */}
                        <div className="pt-2 border-t border-slate-100 dark:border-neutral-900 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-neutral-500">
                            {item.authorAvatar ? (
                              <img
                                src={item.authorAvatar}
                                alt={item.authorName}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-neutral-800 text-[9px] flex items-center justify-center font-bold">
                                {item.authorName.charAt(0)}
                              </div>
                            )}
                            <span className="truncate max-w-[80px] text-[10px]">
                              {item.authorName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              id={`vote-retro-card-${item.id}`}
                              onClick={() => handleVote(item.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                                hasVoted
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                              }`}
                              title={t.sprints.voteCard || 'Голосовать'}
                            >
                              <ThumbsUp className={`w-3 h-3 ${hasVoted ? 'fill-indigo-600' : ''}`} />
                              <span>{item.votes || 0}</span>
                            </button>

                            {(item.authorId === currentUser.id || currentUser.role === 'owner' || currentUser.role === 'admin') && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 text-slate-500 dark:text-neutral-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800"
                                title="Удалить карточку"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add Button at Bottom of Column */}
              <button
                onClick={() => {
                  setNewCategory(category);
                  setIsAddModalOpen(true);
                }}
                className="mt-3 w-full py-1.5 flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-neutral-500 hover:text-slate-900 dark:hover:text-neutral-50 bg-white hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg transition-colors font-medium shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal: Add New Retro Card */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-neutral-50">
                {t.sprints.addRetroCard || 'Добавить карточку ретроспективы'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-neutral-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200 block mb-1.5">
                  Категория
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const CatIcon = cfg.icon;
                    const isSelected = newCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium border text-left transition-all ${
                          isSelected
                            ? `${cfg.bgHeader} border-current ring-1 ring-current`
                            : 'bg-white border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900'
                        }`}
                      >
                        <CatIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{(t.sprints as any)[cfg.titleKey] || cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200 block mb-1">
                  Заголовок идеи или наблюдения *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Внедрить лимит WIP в колонке Review"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200 block mb-1">
                  Подробное описание и контекст
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Опишите, что произошло, в чем причина и как это улучшит следующий спринт..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Extra fields if category is Action Item */}
              {newCategory === 'action_item' && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col gap-3">
                  <span className="text-xs font-bold text-indigo-900">
                    Параметры Action Item:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 block mb-1">
                        Исполнитель
                      </label>
                      <select
                        value={newAssigneeId}
                        onChange={(e) => setNewAssigneeId(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 dark:border-neutral-700 rounded-md p-1.5"
                      >
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 block mb-1">
                        Приоритет
                      </label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as any)}
                        className="w-full text-xs bg-white border border-slate-300 dark:border-neutral-700 rounded-md p-1.5"
                      >
                        <option value="urgent">P0 - Blocker</option>
                        <option value="high">P1 - High</option>
                        <option value="medium">P2 - Medium</option>
                        <option value="low">P3 - Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 block mb-1">
                        Срок реализации
                      </label>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 dark:border-neutral-700 rounded-md p-1.5"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-neutral-900">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Сохранение...' : 'Опубликовать карточку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: AI Retrospective Generator */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-neutral-50">
                  {t.sprints.generateAiRetroBtn || 'Сгенерировать AI-ретроспективу'}
                </h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-500 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-neutral-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
                AI проанализирует все закрытые и зависшие задачи, Story Points, логирование
                рабочего времени и активность команды, сгенерировав полный отчет и структурированные
                карточки по 5 категориям.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200 block mb-1">
                  Особый фокус ретроспективы (опционально):
                </label>
                <input
                  type="text"
                  value={aiFocusArea}
                  onChange={(e) => setAiFocusArea(e.target.value)}
                  placeholder="Например: фокус на код-ревью, стабильности релиза или тестах"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-900 p-3 rounded-lg border border-slate-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  id="save-as-doc-checkbox"
                  checked={saveAsDoc}
                  onChange={(e) => setSaveAsDoc(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="save-as-doc-checkbox" className="text-xs text-slate-700 dark:text-neutral-200 font-medium cursor-pointer">
                  Сохранить готовый Markdown-отчет в <strong>Документы Базы знаний</strong>
                </label>
              </div>

              {aiSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-neutral-900">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  disabled={isAiGenerating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  id="start-ai-retro-generation-btn"
                  onClick={handleRunAiRetro}
                  disabled={isAiGenerating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.sprints.generateAiRetroLoading || 'Генерация...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Запустить генерацию</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
