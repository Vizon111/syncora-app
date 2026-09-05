import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/ai/gemini';
import { db } from '@/lib/db/storage';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';

const DIGEST_WINDOW_DAYS = 7;

/** Generates a plain-language weekly progress summary for one project,
 *  suitable for pasting straight into an email or message to a client.
 *  Built from the project's own tasks (not the workspace activity log,
 *  which has no project_id to filter by — see the comment on
 *  ActivityLog in lib/types.ts) filtered to the last 7 days by
 *  completedAt / updatedAt. This is a plain-text response, not the app's
 *  usual JSON-schema AI calls, since the whole point is prose a human
 *  will read as-is. */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, workspaceId } = body as { projectId?: string; workspaceId?: string };
  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'projectId and workspaceId are required' }, { status: 400 });
  }

  const member = await db.getWorkspaceUser(workspaceId, authUser.id);
  if (!member) {
    return NextResponse.json({ error: 'Tenant boundary violation: not a member of this workspace.' }, { status: 403 });
  }

  const rateLimit = await checkAiRateLimit(authUser.id, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const project = await db.getProjectById(projectId, workspaceId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allTasks = await db.getTasks(workspaceId, projectId);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - DIGEST_WINDOW_DAYS);

  const completedThisWeek = allTasks.filter(
    (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= windowStart
  );
  const updatedThisWeek = allTasks.filter(
    (t) => t.status !== 'done' && new Date(t.updatedAt) >= windowStart
  );
  const inProgress = allTasks.filter((t) => t.status === 'in_progress');
  const upcoming = allTasks.filter((t) => t.status === 'todo').slice(0, 8);

  if (completedThisWeek.length === 0 && updatedThisWeek.length === 0 && inProgress.length === 0) {
    return NextResponse.json({
      digest: `No activity on ${project.name} in the last ${DIGEST_WINDOW_DAYS} days. Nothing to report this week.`,
    });
  }

  const listOrNone = (items: typeof allTasks, label: string) =>
    items.length > 0 ? items.map((t) => `- ${t.title}`).join('\n') : `(no ${label} this period)`;

  const userContent = `PROJECT: ${project.name}
DESCRIPTION: ${project.description || 'N/A'}
OVERALL PROGRESS: ${project.progress}%
STATUS: ${project.status}

COMPLETED IN THE LAST ${DIGEST_WINDOW_DAYS} DAYS:
${listOrNone(completedThisWeek, 'tasks completed')}

CURRENTLY IN PROGRESS:
${listOrNone(inProgress, 'tasks in progress')}

RECENTLY UPDATED (not yet done):
${listOrNone(updatedThisWeek, 'other updates')}

UPCOMING / NOT STARTED:
${listOrNone(upcoming, 'upcoming tasks')}`;

  const systemInstruction = `You write short, friendly weekly progress updates that a freelancer sends to their client. You are given a raw list of task titles and statuses for one project — turn it into 3-5 sentences of plain, confident prose, not a bulleted restatement of the input.

RULES:
- Write in the same language as the project name/description appear to be in (if Russian, reply in Russian; otherwise English).
- Tone: professional but warm, like a short personal update — not corporate reporting.
- Lead with what was actually accomplished this week. Mention what's actively being worked on. Only mention what's upcoming if there's room without the whole thing getting long.
- Do not invent details, numbers, or task names that weren't given to you.
- Do not use markdown formatting, headers, or bullet points — this is meant to be pasted directly into an email or chat message as plain paragraphs.
- Keep it to one short paragraph, occasionally two if there's a lot to report. Never pad it out.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userContent,
      config: { systemInstruction },
    });

    const digest = response.text?.trim();
    if (!digest) throw new Error('Empty response from model');

    return NextResponse.json({ digest });
  } catch (err) {
    console.error('[digest] generation failed', err);
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 });
  }
}
