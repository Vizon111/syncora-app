import { NextRequest, NextResponse } from 'next/server';
import { executeRagChat } from '@/lib/ai/rag-engine';
import { db } from '@/lib/db/storage';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const body = await req.json();
  const { workspaceId, prompt, history } = body;

  if (!prompt || !workspaceId) {
    return NextResponse.json({ error: 'Workspace ID and prompt are required' }, { status: 400 });
  }

  // Tenant authorization check
  const member = await db.getWorkspaceUser(workspaceId, userId);
  if (!member) {
    return NextResponse.json({ error: 'Tenant boundary violation: User is not authorized in this workspace.' }, { status: 403 });
  }

  const rateLimit = await checkAiRateLimit(userId, 15);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const result = await executeRagChat(workspaceId, prompt, history || []);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('RAG Endpoint Error:', error);
    return NextResponse.json({
      text: 'Не найдено достаточно информации в workspace.',
      citations: [],
    });
  }
}
