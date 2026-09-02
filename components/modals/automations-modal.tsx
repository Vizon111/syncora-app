'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  RotateCw,
  X,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface AutomationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AutomationRule {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  lastTriggered?: string;
}

export function AutomationsModal({ isOpen, onClose }: AutomationsModalProps) {
  const { tasks, updateTask, t } = useWorkspace();
  const [isRunningEvaluation, setIsRunningEvaluation] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [rules, setRules] = useState<AutomationRule[]>(() => {
    try {
      const saved = localStorage.getItem('flowspace_automations');
      if (saved) return JSON.parse(saved);
    } catch {}

    return [
      {
        id: 'rule_zero_hours',
        titleKey: 'rule1Title',
        descKey: 'rule1Desc',
        icon: Clock,
        enabled: true,
        lastTriggered: '10 мин. назад',
      },
      {
        id: 'rule_p0_alert',
        titleKey: 'rule2Title',
        descKey: 'rule2Desc',
        icon: AlertTriangle,
        enabled: true,
        lastTriggered: 'Сегодня, 11:30',
      },
      {
        id: 'rule_review_assign',
        titleKey: 'rule3Title',
        descKey: 'rule3Desc',
        icon: UserCheck,
        enabled: true,
        lastTriggered: 'Вчера',
      },
      {
        id: 'rule_deadline_warn',
        titleKey: 'rule4Title',
        descKey: 'rule4Desc',
        icon: Zap,
        enabled: true,
        lastTriggered: '1 час назад',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('flowspace_automations', JSON.stringify(rules));
    } catch {}
  }, [rules]);

  if (!isOpen) return null;

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRunEvaluation = async () => {
    setIsRunningEvaluation(true);
    setStatusMessage('Выполняется оценка условий правил...');

    // Execute rule 1 if enabled: log any remaining estimated hours on done
    // tasks as worklog time, so "remaining" (estimated - logged) becomes 0
    // without discarding the task's time-tracking history.
    let updatedCount = 0;
    const zeroRule = rules.find((r) => r.id === 'rule_zero_hours');
    if (zeroRule?.enabled) {
      for (const task of tasks) {
        const estimated = task.estimatedHours ?? 0;
        const logged = (task.worklogs ?? []).reduce((sum, w) => sum + w.hours, 0);
        const remaining = estimated - logged;
        if (task.status === 'done' && remaining > 0) {
          await updateTask({
            ...task,
            worklogs: [
              ...(task.worklogs ?? []),
              {
                id: `worklog_${Date.now()}_${task.id}`,
                taskId: task.id,
                userId: 'system',
                hours: remaining,
                description: 'Auto-logged by automation: zero remaining hours on done tasks',
                loggedAt: new Date().toISOString(),
              },
            ],
          });
          updatedCount++;
        }
      }
    }

    setTimeout(() => {
      setIsRunningEvaluation(false);
      setStatusMessage(
        updatedCount > 0
          ? `Правила выполнены! Обновлено задач: ${updatedCount}.`
          : 'Все правила активны. Нарушений и несоответствий не обнаружено.'
      );
      setTimeout(() => setStatusMessage(null), 3500);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">{t.automations.title}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">{t.automations.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rules List */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {rules.map((rule) => {
            const Icon = rule.icon;
            const title = (t.automations as any)[rule.titleKey] || rule.id;
            const desc = (t.automations as any)[rule.descKey] || '';

            return (
              <div
                key={rule.id}
                className={`p-4 rounded-2xl border transition-all ${
                  rule.enabled
                    ? 'bg-neutral-950/60 border-neutral-800'
                    : 'bg-neutral-950/20 border-neutral-850 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        rule.enabled
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-200">{title}</h4>
                      <p className="text-3xs text-neutral-400 mt-0.5 leading-relaxed">{desc}</p>
                      {rule.lastTriggered && (
                        <span className="inline-block mt-2 text-3xs text-neutral-500 font-mono">
                          Последнее срабатывание: {rule.lastTriggered}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className="p-1 text-neutral-300 hover:text-white transition-colors shrink-0"
                    title={rule.enabled ? t.automations.active : t.automations.inactive}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-7 h-7 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-neutral-600" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {statusMessage && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <button
            onClick={handleRunEvaluation}
            disabled={isRunningEvaluation}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors disabled:opacity-50"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${isRunningEvaluation ? 'animate-spin text-amber-400' : ''}`}
            />
            <span>Проверить правила сейчас</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
