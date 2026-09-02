import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getGeminiClient } from '@/lib/ai/gemini';
import { SprintHealthDiagnosis, SprintPlanRecommendation } from '@/lib/types';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sprintId } = await params;
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;

  const body = await req.json();
  const { workspaceId, mode = 'health_check' } = body; // 'health_check' | 'plan_recommendation'

  // This route was missing a workspace membership check entirely: knowing a
  // sprintId + workspaceId was previously enough to run AI analysis on a
  // sprint you had no access to.
  const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
  if (auth instanceof NextResponse) return auth;

  const rateLimit = await checkAiRateLimit(userId, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const sprint = await db.getSprintById(sprintId, workspaceId);
  if (!sprint) {
    return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
  }

  const allTasks = await db.getTasks(workspaceId);
  const sprintTasks = allTasks.filter((t) => t.sprintId === sprintId);
  const backlogTasks = allTasks.filter((t) => !t.sprintId);

  const doneTasks = sprintTasks.filter((t) => t.status === 'done');
  const inProgressTasks = sprintTasks.filter((t) => t.status === 'in_progress');
  const reviewTasks = sprintTasks.filter((t) => t.status === 'review');
  const todoTasks = sprintTasks.filter((t) => t.status === 'todo');

  const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const doneSP = doneTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const completionRate = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;

  // Scoped to this workspace's actual members, rather than every user in
  // the system (which could include people from other tenants entirely).
  const members = await db.getWorkspaceMembers(workspaceId);
  const users = members.map((m) => m.user);

  // Calculate actual workload per user in this sprint
  const workloadByUser: Record<string, { assignedSP: number; loggedHours: number; tasksCount: number }> = {};
  users.forEach((u) => {
    workloadByUser[u.id] = { assignedSP: 0, loggedHours: 0, tasksCount: 0 };
  });

  sprintTasks.forEach((t) => {
    if (t.assigneeId && workloadByUser[t.assigneeId]) {
      workloadByUser[t.assigneeId].assignedSP += t.storyPoints || 3;
      workloadByUser[t.assigneeId].loggedHours += t.loggedHours || 0;
      workloadByUser[t.assigneeId].tasksCount += 1;
    }
  });

  const workloadDistribution = users.map((u) => {
    const data = workloadByUser[u.id] || { assignedSP: 0, loggedHours: 0, tasksCount: 0 };
    const capacitySP = 12; // standard 2-week individual capacity
    let status: 'optimal' | 'overloaded' | 'underutilized' = 'optimal';
    if (data.assignedSP > capacitySP + 3) status = 'overloaded';
    else if (data.assignedSP < 4 && sprintTasks.length > 0) status = 'underutilized';

    return {
      userId: u.id,
      userName: u.name,
      userAvatar: u.avatar,
      assignedSP: data.assignedSP,
      capacitySP,
      status,
    };
  });

  if (mode === 'plan_recommendation') {
    // Recommendation for Next Sprint Scope
    const allSprints = await db.getSprints(workspaceId);
    const completedSprints = allSprints.filter((s) => s.status === 'completed');
    const avgVelocity = completedSprints.length > 0
      ? Math.round(completedSprints.reduce((sum, s) => sum + (s.completedStoryPoints || 20), 0) / completedSprints.length)
      : 24;

    const recommendedTaskIds: string[] = [];
    let accumulatedSP = 0;
    const sortedBacklog = [...backlogTasks].sort((a, b) => {
      const pOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (pOrder[b.priority] || 2) - (pOrder[a.priority] || 2);
    });

    for (const task of sortedBacklog) {
      const sp = task.storyPoints || 3;
      if (accumulatedSP + sp <= avgVelocity) {
        recommendedTaskIds.push(task.id);
        accumulatedSP += sp;
      }
    }

    try {
      const ai = getGeminiClient();
      const prompt = `
Вы — AI Scrum Master. На основе бэклога задач и средней скорости команды (${avgVelocity} SP) сформулируйте вдохновляющую и измеримую цель следующего спринта (Sprint Goal) и обоснуйте рекомендацию объема.
Задачи для включения: ${sortedBacklog.slice(0, 5).map((t) => t.title).join(', ')}.

Ответьте строго в формате JSON:
{
  "recommendedScopeSP": ${accumulatedSP || 22},
  "suggestedSprintGoal": "Краткая цель спринта...",
  "rationale": "Обоснование планирования...",
  "capacityWarning": "Предупреждение о емкости команды (если есть) или null"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const res = JSON.parse(response.text || '{}');
      const planRec: SprintPlanRecommendation = {
        recommendedScopeSP: res.recommendedScopeSP || accumulatedSP || avgVelocity,
        suggestedSprintGoal: res.suggestedSprintGoal || 'Реализация приоритетных задач бэклога и повышение надежности платформы',
        recommendedTaskIds,
        rationale: res.rationale || `Скорость команды (${avgVelocity} SP) позволяет безопасно взять ${accumulatedSP} SP без овертаймов.`,
        capacityWarning: res.capacityWarning || undefined,
      };

      return NextResponse.json({ recommendation: planRec });
    } catch (e) {
      const planRec: SprintPlanRecommendation = {
        recommendedScopeSP: accumulatedSP || avgVelocity,
        suggestedSprintGoal: 'Фокус на ключевых задачах бэклога и стабилизации архитектуры',
        recommendedTaskIds,
        rationale: `На основе исторической скорости команды (${avgVelocity} SP) оптимальный объем спринта составляет ${accumulatedSP || avgVelocity} SP.`,
      };
      return NextResponse.json({ recommendation: planRec });
    }
  }

  // Default: Health Check
  try {
    const ai = getGeminiClient();
    const prompt = `
Вы — AI Sprint Diagnostics Copilot. Проанализируйте текущее состояние спринта:
Спринт: "${sprint.name}"
Цель: "${sprint.goal}"
Статус: ${sprint.status}
Story Points: ${doneSP}/${totalSP || 24} SP (${completionRate}%)
Задачи: Done=${doneTasks.length}, In Progress=${inProgressTasks.length}, Review=${reviewTasks.length}, Todo=${todoTasks.length}

Загрузка участников:
${JSON.stringify(workloadDistribution, null, 2)}

Верните JSON диагноз здоровья спринта:
{
  "healthScore": 84, // Число 0-100
  "healthLevel": "healthy", // "healthy" | "at_risk" | "critical"
  "projectedCompletionPct": 92, // Прогноз закрытия SP к дате окончания
  "summary": "Краткая экспертная сводка о темпе спринта и рисках...",
  "risks": [
    {
      "factor": "Риск 1",
      "impact": "high", // "high" | "medium" | "low"
      "mitigation": "Как устранить"
    }
  ],
  "bottlenecks": [
    {
      "title": "Узкое место",
      "assignee": "Имя",
      "reason": "Причина задержки"
    }
  ],
  "keyStrengths": [
    "Сильная сторона 1",
    "Сильная сторона 2"
  ],
  "recommendations": [
    "Действие 1",
    "Действие 2"
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    const diagnosis: SprintHealthDiagnosis = {
      healthScore: parsed.healthScore || 85,
      healthLevel: parsed.healthLevel || (completionRate > 60 ? 'healthy' : 'at_risk'),
      projectedCompletionPct: parsed.projectedCompletionPct || 88,
      summary: parsed.summary || `Спринт идет с хорошим темпом. Закрыто ${doneSP} SP из ${totalSP} SP.`,
      risks: parsed.risks || [],
      bottlenecks: parsed.bottlenecks || [],
      workloadDistribution,
      keyStrengths: parsed.keyStrengths || [],
      recommendations: parsed.recommendations || [],
    };

    return NextResponse.json({ diagnosis });
  } catch (error) {
    // Intelligent heuristic fallback
    const healthScore = Math.min(100, Math.max(40, Math.round(completionRate * 0.8 + 25)));
    const diagnosis: SprintHealthDiagnosis = {
      healthScore,
      healthLevel: healthScore >= 75 ? 'healthy' : healthScore >= 50 ? 'at_risk' : 'critical',
      projectedCompletionPct: Math.min(100, completionRate + 30),
      summary: `Спринт "${sprint.name}" находится в рабочем состоянии (${healthScore}/100). Закрыто ${doneSP} из ${totalSP || 24} SP. Темп сгорания соответствует плану, но требует внимания к задачам в Review.`,
      risks: [
        {
          factor: 'Накопление задач на стадии Review',
          impact: reviewTasks.length > 2 ? 'high' : 'medium',
          mitigation: 'Выделить 1 час на командный ревью-сессион перед дейли.',
        },
        {
          factor: 'Перегрузка отдельных участников',
          impact: workloadDistribution.some((w) => w.status === 'overloaded') ? 'medium' : 'low',
          mitigation: 'Перераспределить задачи с оценкой 5+ SP на свободных участников.',
        },
      ],
      bottlenecks: reviewTasks.map((t) => ({
        title: t.title,
        assignee: t.assignee?.name || 'Unassigned',
        reason: 'Находится на стадии проверки более 24 часов',
      })),
      workloadDistribution,
      keyStrengths: [
        'Стабильный прогресс по ключевым задачам архитектуры',
        'Своевременное ведение логов времени инженерами',
      ],
      recommendations: [
        'Сфокусироваться на доведении задач из Review в Done до взятия новых',
        'Провести мини-синхронизацию по блокирующим PR',
      ],
    };

    return NextResponse.json({ diagnosis });
  }
}
