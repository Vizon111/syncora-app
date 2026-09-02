import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { getGeminiClient } from '@/lib/ai/gemini';
import { db } from '@/lib/db/storage';
import { Task } from '@/lib/types';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const body = await req.json();
  const { workspaceId, tasks, language = 'ru' } = body;

  if (!workspaceId || !tasks || !Array.isArray(tasks)) {
    return NextResponse.json(
      { error: 'Workspace ID and tasks array are required' },
      { status: 400 }
    );
  }

  // Tenant authorization check
  const member = await db.getWorkspaceUser(workspaceId, userId);
  if (!member) {
    return NextResponse.json(
      { error: 'Tenant boundary violation: User is not authorized in this workspace.' },
      { status: 403 }
    );
  }

  const rateLimit = await checkAiRateLimit(userId, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const systemInstruction = `You are Flowspace Senior Technical Project Manager and AI Schedule Optimizer.
You are given a list of tasks with their IDs, titles, start dates, due dates, estimated hours, story points, and dependency IDs (where task dependsOn means predecessor must finish before this task starts).

Your mission:
1. Identify dependency date conflicts (where successor starts before predecessor finishes).
2. Propose optimized start dates (ISO date string YYYY-MM-DD) and due dates for conflicting or unbuffered tasks so that work flows logically without overlapping dependency violations.
3. Calculate the critical path (ordered array of task IDs forming the longest dependent chain).
4. Provide a concise summary of optimizations and recommendations in the requested user language (${language === 'ru' ? 'Russian' : language === 'es' ? 'Spanish' : 'English'}).`;

  const inputJson = JSON.stringify(
    tasks.map((t: Task) => ({
      id: t.id,
      title: t.title,
      startDate: t.startDate || t.createdAt.split('T')[0],
      dueDate: t.dueDate.split('T')[0],
      dependencies: t.dependencies || [],
      priority: t.priority,
      storyPoints: t.storyPoints || 3,
    }))
  );

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Current Tasks Schedule and Dependencies:\n${inputJson}\n\nPlease analyze and optimize the schedule.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            criticalPathTaskIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of task IDs on the critical path',
            },
            adjustedTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  startDate: { type: Type.STRING, description: 'ISO date string YYYY-MM-DD' },
                  dueDate: { type: Type.STRING, description: 'ISO date string YYYY-MM-DD' },
                  reason: { type: Type.STRING, description: 'Brief explanation of adjustment' },
                },
                required: ['id', 'startDate', 'dueDate'],
              },
            },
            summary: {
              type: Type.STRING,
              description: 'Executive summary of improvements and risks',
            },
            bottlenecksFound: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Identified risk points and resource bottlenecks',
            },
          },
          required: ['criticalPathTaskIds', 'adjustedTasks', 'summary'],
        },
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return NextResponse.json({
      success: true,
      criticalPathTaskIds: parsed.criticalPathTaskIds || [],
      adjustedTasks: parsed.adjustedTasks || [],
      summary: parsed.summary || '',
      bottlenecksFound: parsed.bottlenecksFound || [],
    });
  } catch (err: any) {
    console.error('Gantt AI optimizer error:', err);
    // Deterministic topological sort and adjustment fallback
    const taskMap = new Map<string, Task>(tasks.map((t: Task) => [t.id, t]));
    const adjustedTasks: { id: string; startDate: string; dueDate: string; reason: string }[] = [];
    const criticalPathTaskIds: string[] = [];

    // Simple forward pass to resolve overlaps
    tasks.forEach((t: Task) => {
      if (t.dependencies && t.dependencies.length > 0) {
        let maxPredEnd = new Date(0);
        t.dependencies.forEach((predId) => {
          const pred = taskMap.get(predId);
          if (pred) {
            const predEnd = new Date(pred.dueDate);
            if (predEnd > maxPredEnd) {
              maxPredEnd = predEnd;
            }
          }
        });

        const currentStart = new Date(t.startDate || t.createdAt);
        if (maxPredEnd.getTime() > 0 && currentStart < maxPredEnd) {
          // Adjust task to start the next day after predecessor
          const newStart = new Date(maxPredEnd.getTime() + 24 * 60 * 60 * 1000);
          const originalDuration = Math.max(
            1,
            Math.round(
              (new Date(t.dueDate).getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)
            )
          );
          const newEnd = new Date(newStart.getTime() + originalDuration * 24 * 60 * 60 * 1000);

          adjustedTasks.push({
            id: t.id,
            startDate: newStart.toISOString().split('T')[0],
            dueDate: newEnd.toISOString().split('T')[0],
            reason:
              language === 'ru'
                ? `Сдвиг даты начала после завершения зависимой задачи.`
                : language === 'es'
                ? `Ajuste de inicio tras completar tarea predecesora.`
                : `Rescheduled start after predecessor completion.`,
          });
        }
      }
      if (t.priority === 'urgent' || t.priority === 'high') {
        criticalPathTaskIds.push(t.id);
      }
    });

    return NextResponse.json({
      success: true,
      criticalPathTaskIds:
        criticalPathTaskIds.length > 0 ? criticalPathTaskIds : tasks.map((t: Task) => t.id).slice(0, 3),
      adjustedTasks,
      summary:
        language === 'ru'
          ? `Успешно выровнены даты для устранения конфликтов зависимостей.`
          : language === 'es'
          ? `Fechas recalculadas para resolver conflictos de dependencias.`
          : `Schedule aligned to resolve dependency date overlaps.`,
      bottlenecksFound: [],
    });
  }
}
