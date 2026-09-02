import { getGeminiClient } from './gemini';
import { db } from '@/lib/db/storage';
import { AiCitation, AiActionProposal } from '@/lib/types';
import { DEMO_PROJECT_ID } from '@/lib/db/demo-ids';

interface RagSearchResult {
  snippet: string;
  sourceType: 'document' | 'task' | 'file' | 'project';
  sourceId: string;
  sourceTitle: string;
  score: number;
}

/**
 * Multi-tenant Semantic & Lexical Context Retriever
 */
export async function retrieveWorkspaceContext(workspaceId: string, query: string, topK = 6): Promise<RagSearchResult[]> {
  const results: RagSearchResult[] = [];
  const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // 1. Search Document Chunks
  const chunks = await db.getDocumentChunks(workspaceId);
  chunks.forEach((chunk) => {
    let score = 0;
    const textLower = chunk.text.toLowerCase();
    const titleLower = chunk.documentTitle.toLowerCase();

    queryTokens.forEach((token) => {
      if (titleLower.includes(token)) score += 3.5;
      if (textLower.includes(token)) score += 1.5;
    });

    if (textLower.includes(query.toLowerCase())) score += 5;

    if (score > 0) {
      results.push({
        snippet: chunk.text,
        sourceType: chunk.documentTitle.startsWith('File:') ? 'file' : 'document',
        sourceId: chunk.documentId,
        sourceTitle: chunk.documentTitle,
        score,
      });
    }
  });

  // 2. Search Tasks in Workspace
  const tasks = await db.getTasks(workspaceId);
  tasks.forEach((task) => {
    let score = 0;
    const titleLower = task.title.toLowerCase();
    const descLower = task.description.toLowerCase();
    const statusLower = task.status.toLowerCase();

    queryTokens.forEach((token) => {
      if (titleLower.includes(token)) score += 3.0;
      if (descLower.includes(token)) score += 1.5;
      if (statusLower.includes(token)) score += 2.0;
    });

    if (score > 0) {
      results.push({
        snippet: `Task: ${task.title} | Status: ${task.status.toUpperCase()} | Priority: ${task.priority.toUpperCase()} | Assignee: ${task.assignee?.name || 'Unassigned'}. Description: ${task.description}`,
        sourceType: 'task',
        sourceId: task.id,
        sourceTitle: task.title,
        score,
      });
    }
  });

  // 3. Search Projects
  const projects = await db.getProjects(workspaceId);
  projects.forEach((proj) => {
    let score = 0;
    const nameLower = proj.name.toLowerCase();
    const descLower = proj.description.toLowerCase();

    queryTokens.forEach((token) => {
      if (nameLower.includes(token)) score += 3.0;
      if (descLower.includes(token)) score += 1.5;
    });

    if (score > 0) {
      results.push({
        snippet: `Project: ${proj.name} | Status: ${proj.status} | Progress: ${proj.progress}% | Lead: ${proj.lead?.name}. ${proj.description}`,
        sourceType: 'project',
        sourceId: proj.id,
        sourceTitle: proj.name,
        score,
      });
    }
  });

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Execute Workspace RAG Query with Gemini 3.7 Flash
 */
export async function executeRagChat(
  workspaceId: string,
  userPrompt: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<{ text: string; citations: AiCitation[]; actionProposal?: AiActionProposal }> {
  const ai = getGeminiClient();
  const contextResults = await retrieveWorkspaceContext(workspaceId, userPrompt);

  const citations: AiCitation[] = contextResults.map((r, i) => ({
    id: `cit_${i}_${r.sourceId}`,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    sourceTitle: r.sourceTitle,
    snippet: r.snippet.length > 150 ? r.snippet.slice(0, 150) + '...' : r.snippet,
    score: Math.min(0.99, 0.6 + r.score * 0.05),
  }));

  const contextText = contextResults
    .map(
      (r, idx) =>
        `[Source #${idx + 1}: ${r.sourceType.toUpperCase()} "${r.sourceTitle}"]\n${r.snippet}\n`
    )
    .join('\n---\n');

  const systemInstruction = `You are Flowspace AI, an intelligent workspace knowledge engine and collaboration assistant for team workspaces.
You have access to the real-time context of the current workspace: projects, tasks, documents, files, and comments.

RULES FOR ANSWERING:
1. ALWAYS ground your answers in the provided workspace context below.
2. If the user asks about specific tasks (e.g., "какие задачи по проекту Alpha ещё не завершены?", "what tasks are open?"), list the real tasks from the context with their statuses, assignees, and priorities.
3. If the user asks to summarize a document, summarize the actual text from the document context.
4. CITE YOUR SOURCES: When referencing information, mention the document or task name (e.g. "[PRD Flowspace Core]").
5. NO HALLUCINATIONS: If the provided context does NOT contain enough relevant information to answer accurately, you MUST explicitly state in the user's language:
   "Не найдено достаточно информации в workspace." (or "Not enough information found in the current workspace.") Do not make up facts or invent non-existent tasks.
6. SAFE ACTIONS: If the user asks you to create a task, update a task, or extract action items, propose the structured action in your response and describe what will be created.

CURRENT WORKSPACE CONTEXT:
${contextText.length > 0 ? contextText : '(No matching documents or tasks found in this workspace)'}
`;

  try {
    const formattedContents = [
      ...chatHistory.slice(-4).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: formattedContents as any,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const responseText = response.text || 'Не удалось сгенерировать ответ.';

    let actionProposal: AiActionProposal | undefined;
    const lowerPrompt = userPrompt.toLowerCase();
    if (
      lowerPrompt.includes('создай задачу') ||
      lowerPrompt.includes('create task') ||
      lowerPrompt.includes('выдели action items') ||
      lowerPrompt.includes('создать 5 задач') ||
      lowerPrompt.includes('action items')
    ) {
      actionProposal = {
        id: crypto.randomUUID(),
        type: 'create_task',
        title: 'Создание задачи на основе запроса',
        description: 'AI сформировал проект задачи из контекста workspace. Подтвердите создание в канбан-доске.',
        payload: {
          title: userPrompt.length > 60 ? userPrompt.slice(0, 60) + '...' : userPrompt,
          projectId: DEMO_PROJECT_ID,
          status: 'todo',
          priority: 'high',
        },
        isDestructive: false,
        status: 'pending',
      };
    }

    return {
      text: responseText,
      citations: contextResults.length > 0 ? citations : [],
      actionProposal,
    };
  } catch (err: any) {
    console.error('Gemini RAG Generation Error:', err);
    if (contextResults.length > 0) {
      return {
        text: `На основе данных вашего workspace:\n\n` +
          contextResults.map((c) => `• **${c.sourceTitle}**: ${c.snippet}`).join('\n\n'),
        citations,
      };
    }
    return {
      text: 'Не найдено достаточно информации в workspace.',
      citations: [],
    };
  }
}
