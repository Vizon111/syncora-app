import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { SearchResult } from '@/lib/types';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  const query = (searchParams.get('q') || '').trim().toLowerCase();

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResult[] = [];

  // Search Projects
  const projects = await db.getProjects(workspaceId);
  projects.forEach((proj) => {
    if (proj.name.toLowerCase().includes(query) || proj.description.toLowerCase().includes(query)) {
      results.push({
        id: proj.id,
        type: 'project',
        title: proj.name,
        subtitle: `Project • ${proj.status} • ${proj.progress}% progress`,
        snippet: proj.description,
        relevance: proj.name.toLowerCase().includes(query) ? 10 : 5,
        url: `/projects?id=${proj.id}`,
      });
    }
  });

  // Search Tasks
  const tasks = await db.getTasks(workspaceId);
  tasks.forEach((task) => {
    if (
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.labels.some((l) => l.toLowerCase().includes(query))
    ) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: `Task • ${task.status.toUpperCase()} • ${task.priority.toUpperCase()} priority`,
        snippet: task.description,
        relevance: task.title.toLowerCase().includes(query) ? 9 : 4,
        url: `/tasks?id=${task.id}`,
      });
    }
  });

  // Search Documents
  const docs = await db.getDocuments(workspaceId);
  docs.forEach((doc) => {
    if (doc.title.toLowerCase().includes(query) || doc.rawText.toLowerCase().includes(query)) {
      // Find matching snippet context
      let snippet = doc.rawText.slice(0, 120);
      const matchIdx = doc.rawText.toLowerCase().indexOf(query);
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 40);
        const end = Math.min(doc.rawText.length, matchIdx + 80);
        snippet = '...' + doc.rawText.slice(start, end) + '...';
      }

      results.push({
        id: doc.id,
        type: 'document',
        title: `${doc.emoji || '📄'} ${doc.title}`,
        subtitle: `Document • v${doc.version} • Author: ${doc.author?.name || 'Team'}`,
        snippet,
        relevance: doc.title.toLowerCase().includes(query) ? 10 : 6,
        url: `/documents?id=${doc.id}`,
      });
    }
  });

  // Search Files
  const files = await db.getFiles(workspaceId);
  files.forEach((file) => {
    if (file.name.toLowerCase().includes(query) || (file.extractedText && file.extractedText.toLowerCase().includes(query))) {
      results.push({
        id: file.id,
        type: 'file',
        title: file.name,
        subtitle: `File • ${Math.round(file.size / 1024)} KB • ${file.type}`,
        snippet: file.extractedText ? file.extractedText.slice(0, 100) : '',
        relevance: file.name.toLowerCase().includes(query) ? 8 : 3,
        url: `/files?id=${file.id}`,
      });
    }
  });

  // Sort results by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);

  return NextResponse.json({ results });
}
