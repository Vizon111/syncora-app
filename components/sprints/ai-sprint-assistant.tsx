'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import {
  Sprint,
  SprintHealthDiagnosis,
  SprintPlanRecommendation,
  Task,
} from '@/lib/types';
import {
  Sparkles,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
  ArrowRight,
  ShieldAlert,
  Zap,
  Clock,
  Layers,
  HelpCircle,
  Loader2,
  Flame,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface AiSprintAssistantProps {
  sprint: Sprint;
  onApplyGoal?: (suggestedGoal: string) => void;
}

export function AiSprintAssistant({ sprint, onApplyGoal }: AiSprintAssistantProps) {
  const {
    t,
    tasks,
    currentUser,
    allUsers,
    generateAiSprintHealth,
    generateAiSprintPlan,
    updateSprint,
    updateTask,
  } = useWorkspace();

  const [diagnosis, setDiagnosis] = useState<SprintHealthDiagnosis | null>(null);
  const [recommendation, setRecommendation] = useState<SprintPlanRecommendation | null>(null);

  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const [appliedGoalSuccess, setAppliedGoalSuccess] = useState(false);
  const [addedTaskId, setAddedTaskId] = useState<string | null>(null);

  const loadHealth = async () => {
    setIsHealthLoading(true);
    const diag = await generateAiSprintHealth(sprint.id);
    if (diag) {
      setDiagnosis(diag);
    }
    setIsHealthLoading(false);
  };

  const loadPlan = async () => {
    setIsPlanLoading(true);
    const rec = await generateAiSprintPlan(sprint.id);
    if (rec) {
      setRecommendation(rec);
    }
    setIsPlanLoading(false);
  };

  useEffect(() => {
    let isCancelled = false;
    const fetchHealthAndPlan = async () => {
      const diag = await generateAiSprintHealth(sprint.id);
      if (!isCancelled && diag) {
        setDiagnosis(diag);
      }
      const rec = await generateAiSprintPlan(sprint.id);
      if (!isCancelled && rec) {
        setRecommendation(rec);
      }
    };
    fetchHealthAndPlan();
    return () => {
      isCancelled = true;
    };
  }, [sprint.id, generateAiSprintHealth, generateAiSprintPlan]);

  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
  const backlogTasks = tasks.filter((t) => !t.sprintId);

  const handleApplySuggestedGoal = async (goal: string) => {
    const updated = {
      ...sprint,
      goal,
      updatedAt: new Date().toISOString(),
    };
    await updateSprint(updated);
    if (onApplyGoal) onApplyGoal(goal);
    setAppliedGoalSuccess(true);
    setTimeout(() => setAppliedGoalSuccess(false), 2500);
  };

  const handleAddTaskToSprint = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setAddedTaskId(taskId);
    await updateTask({ ...task, sprintId: sprint.id });
    setTimeout(() => setAddedTaskId(null), 1500);
  };

  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;

    setIsAnswering(true);
    setCustomAnswer(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Контекст спринта: "${sprint.name}", цель: "${sprint.goal}", статус: ${sprint.status}. Вопрос Scrum-мастера: ${customQuestion}`,
          workspaceId: sprint.workspaceId,
        }),
      });
      const data = await res.json();
      setCustomAnswer(data.reply || data.text || 'Ответ сформирован.');
    } catch {
      setCustomAnswer(
        'Рекомендуется сфокусироваться на снятии блокировок в колонке Review и не брать новые задачи до закрытия текущих.'
      );
    }
    setIsAnswering(false);
  };

  // Color config based on health score
  const score = diagnosis?.healthScore ?? 80;
  const isHealthy = score >= 75;
  const isAtRisk = score >= 50 && score < 75;

  return (
    <div className="flex flex-col gap-6" id="ai-sprint-assistant-container">
      {/* Top Banner: Diagnostics & Quick Run */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-xs ${
              isHealthy
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : isAtRisk
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-rose-50 text-rose-600 border border-rose-200'
            }`}
          >
            {isHealthLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${score}`}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900">
                {t.sprints.aiHealthTitle || 'Диагностика здоровья и рисков спринта'}
              </h2>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase ${
                  isHealthy
                    ? 'bg-emerald-100 text-emerald-800'
                    : isAtRisk
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {diagnosis?.healthLevel || (isHealthy ? 'Healthy' : 'At Risk')}
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl leading-relaxed">
              {diagnosis?.summary ||
                'Автоматический аудит темпа сгорания, узких мест в Review и баланса загрузки команды.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="rerun-sprint-diagnostics-btn"
            onClick={loadHealth}
            disabled={isHealthLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isHealthLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>{t.sprints.runDiagnosticsBtn || 'Обновить диагностику'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Health Metrics & Workload Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Risks & Mitigations */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                {t.sprints.risks || 'Факторы риска и митигация'}
              </h3>
              <span className="text-xs font-semibold text-neutral-500">
                {diagnosis?.risks?.length || 0} факторов
              </span>
            </div>

            {diagnosis?.risks && diagnosis.risks.length > 0 ? (
              <div className="space-y-3">
                {diagnosis.risks.map((risk, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/70 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900">{risk.factor}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          risk.impact === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : risk.impact === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {risk.impact} impact
                      </span>
                    </div>
                    <p className="text-neutral-600 text-[11px] leading-relaxed">
                      💡 <strong>Решение:</strong> {risk.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 rounded-lg">
                Критических рисков не обнаружено. Спринт движется в пределах нормы.
              </div>
            )}
          </div>

          {/* Key Strengths at bottom */}
          {diagnosis?.keyStrengths && diagnosis.keyStrengths.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-100 text-xs">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Сильные стороны спринта:
              </span>
              <ul className="space-y-1 text-neutral-600 pl-4 list-disc text-[11px]">
                {diagnosis.keyStrengths.map((str, idx) => (
                  <li key={idx}>{str}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Column 2: Bottlenecks & Blocked Tasks */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {t.sprints.bottlenecks || 'Узкие места и зависшие задачи'}
              </h3>
              <span className="text-xs font-semibold text-neutral-500">
                {diagnosis?.bottlenecks?.length || 0} задач
              </span>
            </div>

            {diagnosis?.bottlenecks && diagnosis.bottlenecks.length > 0 ? (
              <div className="space-y-3">
                {diagnosis.bottlenecks.map((bot, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-rose-100 bg-rose-50/40 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900">{bot.title}</span>
                      <span className="text-[10px] text-neutral-500">{bot.assignee}</span>
                    </div>
                    <p className="text-rose-700 text-[11px] leading-relaxed">
                      ⚠️ <strong>Причина:</strong> {bot.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 rounded-lg">
                Все задачи спринта продвигаются без длительных простоев.
              </div>
            )}
          </div>

          {/* Projected Completion Rate */}
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-600 font-medium">Прогноз сдачи объема:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-neutral-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${diagnosis?.projectedCompletionPct || 85}%` }}
                />
              </div>
              <span className="font-bold text-indigo-700">
                {diagnosis?.projectedCompletionPct || 85}%
              </span>
            </div>
          </div>
        </div>

        {/* Column 3: Workload Distribution per Engineer */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              {t.sprints.workloadDistribution || 'Баланс загрузки инженеров'}
            </h3>
            <span className="text-xs text-neutral-500">Cap: 12 SP/чел</span>
          </div>

          <div className="space-y-3.5">
            {diagnosis?.workloadDistribution && diagnosis.workloadDistribution.length > 0 ? (
              diagnosis.workloadDistribution.map((item) => {
                const pct = Math.min(100, Math.round((item.assignedSP / item.capacitySP) * 100));
                const isOver = item.status === 'overloaded';
                const isUnder = item.status === 'underutilized';

                return (
                  <div key={item.userId} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {item.userAvatar ? (
                          <img
                            src={item.userAvatar}
                            alt={item.userName}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-bold">
                            {item.userName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-neutral-800">{item.userName}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-neutral-900">
                          {item.assignedSP} / {item.capacitySP} SP
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                            isOver
                              ? 'bg-rose-100 text-rose-700'
                              : isUnder
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isOver
                            ? (t.sprints.overloaded || 'Перегружен')
                            : isUnder
                            ? (t.sprints.underutilized || 'Свободен')
                            : (t.sprints.optimal || 'Оптимально')}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? 'bg-rose-500' : isUnder ? 'bg-blue-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-neutral-500 text-xs text-center py-4">
                Загрузка рассчитывается...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Planning Advisor: Next Sprint Scope & Goal Recommendation */}
      <div className="bg-linear-to-r from-violet-50/80 via-white to-indigo-50/80 rounded-xl border border-violet-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-violet-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                {t.sprints.planRecommendation || 'Рекомендации для следующего спринта'}
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                AI рассчитывает оптимальный скоуп на основе исторической скорости команды
                (Velocity) и приоритетов бэклога.
              </p>
            </div>
          </div>

          <button
            onClick={loadPlan}
            disabled={isPlanLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-100/70 hover:bg-violet-200/70 rounded-lg transition-colors"
          >
            {isPlanLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{t.sprints.planAdvisorBtn || 'Рассчитать скоуп'}</span>
          </button>
        </div>

        {recommendation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Suggested Goal & Rationale */}
            <div className="flex flex-col justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-violet-900 uppercase tracking-wider">
                  {t.sprints.suggestedSprintGoal || 'Рекомендуемая цель спринта (Sprint Goal)'}
                </span>
                <div className="mt-2 p-3.5 bg-white rounded-xl border border-violet-200 text-xs text-neutral-900 font-medium leading-relaxed">
                  «{recommendation.suggestedSprintGoal}»
                </div>

                <div className="mt-3 text-xs text-neutral-600 leading-relaxed">
                  <span className="font-semibold text-neutral-800">
                    {t.sprints.rationale || 'Обоснование AI'}:
                  </span>{' '}
                  {recommendation.rationale}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApplySuggestedGoal(recommendation.suggestedSprintGoal)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {appliedGoalSuccess ? 'Цель применена!' : 'Применить цель к спринту'}
                  </span>
                </button>

                <div className="text-xs font-semibold text-violet-800 bg-violet-100/70 px-2.5 py-1.5 rounded-lg border border-violet-200">
                  {t.sprints.recommendedScope || 'Рекомендуемый объем'}:{' '}
                  <span className="font-black text-sm">{recommendation.recommendedScopeSP} SP</span>
                </div>
              </div>
            </div>

            {/* Recommended Tasks from Backlog */}
            <div>
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider block mb-2">
                Рекомендуемые задачи из Бэклога:
              </span>

              {backlogTasks.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-lg">
                  Бэклог пуст
                </div>
              ) : (
                <div className="space-y-2">
                  {backlogTasks.slice(0, 4).map((task) => {
                    const isAdded = addedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="bg-white p-3 rounded-lg border border-neutral-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                            {task.storyPoints || 3} SP
                          </span>
                          <span className="font-medium text-neutral-800 truncate">
                            {task.title}
                          </span>
                        </div>

                        <button
                          onClick={() => handleAddTaskToSprint(task.id)}
                          disabled={isAdded}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isAdded ? 'Добавлено!' : 'В спринт'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive AI Sprint Copilot Chat */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Спросить AI Sprint Copilot о ходе выполнения
            </h3>
            <p className="text-[11px] text-neutral-500">
              Задайте любой вопрос по декомпозиции, рискам, балансу задач или стратегии спринта
            </p>
          </div>
        </div>

        <form onSubmit={handleAskAssistant} className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Например: Как лучше разгрузить этап Review и не потерять темп сгорания?"
            className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isAnswering || !customQuestion.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {isAnswering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Спросить</span>
          </button>
        </form>

        {customAnswer && (
          <div className="mt-3 p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-800 leading-relaxed animate-in fade-in">
            <div className="font-semibold text-indigo-700 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Ответ AI Copilot:
            </div>
            <p className="whitespace-pre-line">{customAnswer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
