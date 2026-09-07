import { NextRequest } from 'next/server';
import { executeRagChatStream } from '@/lib/ai/rag-engine';
import { db } from '@/lib/db/storage';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// Streaming responses need the Node.js runtime (not Edge) and must be
// treated as dynamic — otherwise Next.js can evaluate this route at build
// time and serve a cached snapshot instead of a live stream. See
// https://examples.vercel.com/docs/functions/streaming/quickstart
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Streams the AI Copilot's response as Server-Sent Events so the answer
 *  appears incrementally in the UI instead of only after the full
 *  generation finishes. Event shapes (each a `data: {...}\n\n` line):
 *    {"type":"delta","text":"..."}   — one chunk of assistant text
 *    {"type":"done","citations":[...],"actionProposal":{...}|null} — sent
 *      once, after the last delta, since citations/actionProposal are
 *      determined independently of the model's streamed text (see
 *      rag-engine.ts) and the client needs them to render the finished
 *      message's source list / action-confirmation card.
 *    {"type":"error","message":"..."} — sent instead of "done" if
 *      something failed before/during streaming (auth already returns a
 *      plain 4xx below, this is for failures once the stream has started
 *      and a 4xx response is no longer possible).
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const userId = authUser.id;
  const body = await req.json();
  const { workspaceId, prompt, history, sessionId } = body;

  if (!prompt || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Workspace ID and prompt are required' }), { status: 400 });
  }

  // Tenant authorization check
  const member = await db.getWorkspaceUser(workspaceId, userId);
  if (!member) {
    return new Response(
      JSON.stringify({ error: 'Tenant boundary violation: User is not authorized in this workspace.' }),
      { status: 403 }
    );
  }

  const rateLimit = await checkAiRateLimit(userId, 15);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many AI requests. Please slow down.' }), {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    });
  }

  const encoder = new TextEncoder();

  // The ReadableStream's start() callback runs asynchronously — the
  // `return new Response(stream, ...)` below fires as soon as the stream
  // object exists, without waiting for start() to finish. That's what
  // lets chunks flush to the client incrementally instead of Next.js
  // buffering the whole response until this handler returns. See
  // https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const { citations, actionProposal, textStream } = await executeRagChatStream(
          workspaceId,
          prompt,
          history || []
        );

        let fullText = '';
        for await (const chunk of textStream) {
          fullText += chunk;
          send({ type: 'delta', text: chunk });
        }

        send({ type: 'done', citations, actionProposal: actionProposal || null });

        // Persist both sides of the exchange if this message belongs to a
        // saved session. Best-effort: a persistence failure shouldn't turn
        // a successful chat response into an error the user sees — the
        // stream has already been sent and closed from their perspective,
        // so we just log and move on rather than trying to surface this
        // after the fact.
        if (sessionId) {
          try {
            await db.addAiMessage(
              workspaceId,
              userId,
              { id: crypto.randomUUID(), role: 'user', content: prompt },
              sessionId
            );
            await db.addAiMessage(
              workspaceId,
              userId,
              { id: crypto.randomUUID(), role: 'assistant', content: fullText, citations, actionProposal },
              sessionId
            );
            await db.touchChatSession(sessionId, userId);

            // Auto-title new sessions from the first message, same as
            // ChatGPT/Claude do — "New chat" is meaningless in a history
            // list, but re-titling on every message would be pointless
            // churn, so this only fires when history is empty (i.e. this
            // is the session's first exchange).
            if (!history || history.length === 0) {
              const title = prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt;
              await db.renameChatSession(sessionId, userId, title);
            }
          } catch (persistError) {
            console.error('[chat] failed to persist session messages', persistError);
          }
        }
      } catch (error) {
        console.error('RAG Streaming Endpoint Error:', error);
        send({ type: 'error', message: 'Не найдено достаточно информации в workspace.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disables buffering on nginx-fronted proxies so chunks flush immediately
    },
  });
}
