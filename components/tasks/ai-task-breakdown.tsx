'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  CheckSquare,
  ShieldCheck,
  Plus,
  Trash2,
  SlidersHorizontal,
  Loader2,
  RotateCw,
  Tag,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';
import { TaskPriority } from '@/lib/types';

interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

interface CriteriaItem {
  id: string;
  text: string;
  satisfied: boolean;
}

interface AiTaskBreakdownProps {
  title: string;
  description: string;
  projectId?: string;
  subtasks: SubtaskItem[];
  acceptanceCriteria: CriteriaItem[];
  onSubtasksChange: (subtasks: SubtaskItem[]) => void;
  onAcceptanceCriteriaChange: (criteria: CriteriaItem[]) => void;
  onApplyLabels?: (labels: string[]) => void;
  onApplyPriority?: (priority: TaskPriority) => void;
  onApplyStoryPoints?: (storyPoints: number) => void;
  onApplyEstimatedHours?: (hours: number) => void;
}

export function AiTaskBreakdown({
  title,
  description,
  projectId,
  subtasks,
  acceptanceCriteria,
  onSubtasksChange,
  onAcceptanceCriteriaChange,
  onApplyLabels,
  onApplyPriority,
  onApplyStoryPoints,
  onApplyEstimatedHours,
}: AiTaskBreakdownProps) {
  const { t, currentWorkspace, currentUser } = useWorkspace();
  const { success, error, info } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [newCriteriaText, setNewCriteriaText] = useState('');
  const [suggestedLabels, setSuggestedLabels] = useState<string[]>([]);
  const [suggestedPriority, setSuggestedPriority] = useState<TaskPriority | null>(null);
  const [suggestedStoryPoints, setSuggestedStoryPoints] = useState<number | null>(null);
  const [suggestedEstimatedHours, setSuggestedEstimatedHours] = useState<number | null>(null);
  const [complexityReasoning, setComplexityReasoning] = useState<string | null>(null);

  const handleGenerateAiBreakdown = async () => {
    if (!title.trim() && !description.trim()) {
      error(t.tasks.aiNeedTitleError);
      return;
    }

    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          title: title.trim(),
          description: description.trim(),
          projectId,
          additionalInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate breakdown');
      }

      if (data.subtasks && Array.isArray(data.subtasks)) {
        onSubtasksChange(data.subtasks);
      }

      if (data.acceptanceCriteria && Array.isArray(data.acceptanceCriteria)) {
        onAcceptanceCriteriaChange(data.acceptanceCriteria);
      }

      if (data.suggestedLabels && Array.isArray(data.suggestedLabels)) {
        setSuggestedLabels(data.suggestedLabels);
      }

      if (data.suggestedPriority) {
        setSuggestedPriority(data.suggestedPriority as TaskPriority);
      }

      if (data.estimatedStoryPoints) {
        setSuggestedStoryPoints(data.estimatedStoryPoints);
        if (onApplyStoryPoints) {
          onApplyStoryPoints(data.estimatedStoryPoints);
        }
      }

      if (data.estimatedHours) {
        setSuggestedEstimatedHours(data.estimatedHours);
        if (onApplyEstimatedHours) {
          onApplyEstimatedHours(data.estimatedHours);
        }
      }

      if (data.complexityReasoning) {
        setComplexityReasoning(data.complexityReasoning);
      }

      success(t.tasks.aiBreakdownSuccess);
    } catch (err: any) {
      console.error('Error generating AI breakdown:', err);
      error(err.message || 'AI generation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Subtask management
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskText.trim()) return;

    const newItem: SubtaskItem = {
      id: `st_manual_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: newSubtaskText.trim(),
      completed: false,
    };
    onSubtasksChange([...subtasks, newItem]);
    setNewSubtaskText('');
  };

  const handleToggleSubtask = (id: string) => {
    onSubtasksChange(
      subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveSubtask = (id: string) => {
    onSubtasksChange(subtasks.filter((s) => s.id !== id));
  };

  // Criteria management
  const handleAddCriteria = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCriteriaText.trim()) return;

    const newItem: CriteriaItem = {
      id: `ac_manual_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: newCriteriaText.trim(),
      satisfied: false,
    };
    onAcceptanceCriteriaChange([...acceptanceCriteria, newItem]);
    setNewCriteriaText('');
  };

  const handleToggleCriteria = (id: string) => {
    onAcceptanceCriteriaChange(
      acceptanceCriteria.map((c) =>
        c.id === id ? { ...c, satisfied: !c.satisfied } : c
      )
    );
  };

  const handleRemoveCriteria = (id: string) => {
    onAcceptanceCriteriaChange(acceptanceCriteria.filter((c) => c.id !== id));
  };

  const handleClearAll = () => {
    onSubtasksChange([]);
    onAcceptanceCriteriaChange([]);
    setSuggestedLabels([]);
    setSuggestedPriority(null);
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-200/80 dark:border-neutral-800/80">
      {/* AI Generator Action Banner */}
      <div className="p-3 bg-gradient-to-br from-indigo-950/40 via-slate-100 dark:via-neutral-900/60 to-purple-950/30 border border-indigo-500/20 rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-1.5">
                {t.tasks.aiBreakdownTitle}
                <span className="text-2xs font-normal text-indigo-400 bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/40">
                  Gemini 3.7 Flash
                </span>
              </h4>
              <p className="text-2xs text-slate-500 dark:text-neutral-400">
                {subtasks.length === 0 && acceptanceCriteria.length === 0
                  ? 'Автоматически сформировать план реализации и Definition of Done'
                  : `${subtasks.length} подзадач • ${acceptanceCriteria.length} критериев приемки`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showOptions
                  ? 'bg-slate-100 dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200'
                  : 'bg-slate-50/60 dark:bg-neutral-950/60 border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-neutral-300'
              }`}
              title="Настройки генерации"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerateAiBreakdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.tasks.aiBreakdownLoading}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {subtasks.length > 0 || acceptanceCriteria.length > 0
                      ? t.tasks.aiBreakdownBtn
                      : t.tasks.aiBreakdownBtn}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Optional Custom Instructions */}
        {showOptions && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-neutral-800/80 animate-in fade-in">
            <label className="block text-2xs font-semibold text-slate-500 dark:text-neutral-400 mb-1">
              {t.tasks.aiBreakdownPrompt}
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t.tasks.aiBreakdownPromptPlaceholder}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50/80 dark:bg-neutral-950/80 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        )}

        {/* Suggested metadata chips from AI */}
        {(suggestedLabels.length > 0 || suggestedPriority || suggestedStoryPoints || suggestedEstimatedHours || complexityReasoning) && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-neutral-800/60 space-y-2 text-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {suggestedStoryPoints && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold">
                    ⚡ {suggestedStoryPoints} Story Points
                  </span>
                )}

                {suggestedEstimatedHours && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                    ⏱ ~{suggestedEstimatedHours} часов
                  </span>
                )}

                {suggestedPriority && onApplyPriority && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPriority(suggestedPriority);
                      info(`Применен приоритет ${suggestedPriority.toUpperCase()}`);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>Приоритет: {suggestedPriority.toUpperCase()}</span>
                  </button>
                )}

                {suggestedLabels.length > 0 && onApplyLabels && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyLabels(suggestedLabels);
                      info(`Добавлены метки: ${suggestedLabels.join(', ')}`);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Метки: {suggestedLabels.slice(0, 3).join(', ')}</span>
                  </button>
                )}
              </div>

              {(subtasks.length > 0 || acceptanceCriteria.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-500 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                >
                  {t.tasks.clearAllItems}
                </button>
              )}
            </div>

            {complexityReasoning && (
              <div className="p-2 rounded-lg bg-slate-50/60 dark:bg-neutral-950/60 border border-indigo-900/30 text-slate-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                <span className="font-semibold text-indigo-400">🤖 Оценка сложности: </span>
                {complexityReasoning}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtasks Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            {t.tasks.aiSubtasksHeading}
            <span className="text-2xs font-mono text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded">
              {subtasks.length}
            </span>
          </label>
        </div>

        {/* Subtask list */}
        {subtasks.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800/80 hover:border-slate-300 dark:hover:border-neutral-700 transition-all text-xs"
              >
                <div
                  className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                  onClick={() => handleToggleSubtask(sub.id)}
                >
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() => {}}
                    className="rounded border-slate-300 dark:border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                  />
                  <span
                    className={`truncate ${
                      sub.completed ? 'line-through text-slate-500 dark:text-neutral-500' : 'text-slate-700 dark:text-neutral-200'
                    }`}
                  >
                    {sub.title}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSubtask(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 dark:text-neutral-500 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-all"
                  title={t.tasks.removeSubtask}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Subtask input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtaskText}
            onChange={(e) => setNewSubtaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
            placeholder={t.tasks.newSubtaskPlaceholder}
            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => handleAddSubtask()}
            disabled={!newSubtaskText.trim()}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-40 text-slate-700 dark:text-neutral-200 rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.tasks.addSubtaskBtn}</span>
          </button>
        </div>
      </div>

      {/* Acceptance Criteria (DoD) Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {t.tasks.aiCriteriaHeading}
            <span className="text-2xs font-mono text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded">
              {acceptanceCriteria.length}
            </span>
          </label>
        </div>

        {/* Criteria list */}
        {acceptanceCriteria.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {acceptanceCriteria.map((c) => (
              <div
                key={c.id}
                className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800/80 hover:border-slate-300 dark:hover:border-neutral-700 transition-all text-xs"
              >
                <div
                  className="flex items-start gap-2 flex-1 cursor-pointer min-w-0"
                  onClick={() => handleToggleCriteria(c.id)}
                >
                  <input
                    type="checkbox"
                    checked={c.satisfied}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-slate-300 dark:border-neutral-700 text-emerald-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                  />
                  <span
                    className={`text-xs ${
                      c.satisfied ? 'line-through text-slate-500 dark:text-neutral-500' : 'text-slate-700 dark:text-neutral-200'
                    }`}
                  >
                    {c.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCriteria(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 dark:text-neutral-500 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-all shrink-0"
                  title={t.tasks.removeCriteria}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Criteria input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCriteriaText}
            onChange={(e) => setNewCriteriaText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCriteria();
              }
            }}
            placeholder={t.tasks.newCriteriaPlaceholder}
            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50/70 dark:bg-neutral-950/70 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => handleAddCriteria()}
            disabled={!newCriteriaText.trim()}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-40 text-slate-700 dark:text-neutral-200 rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.tasks.addCriteriaBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
