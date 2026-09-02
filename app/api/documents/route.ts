import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getOrCreateYDoc, encodeDocStateBase64, applyBase64Update, computeDeltaUpdate } from '@/lib/crdt/yjs-engine';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { Document } from '@/lib/types';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  const docId = searchParams.get('docId');

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  if (docId) {
    const doc = await db.getDocumentById(docId, workspaceId);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Sync with Y.Doc session state
    const session = getOrCreateYDoc(doc.id, doc.rawText);
    const clientStateVector = searchParams.get('stateVector') || undefined;
    const delta = computeDeltaUpdate(session.doc, clientStateVector);

    return NextResponse.json({
      document: doc,
      currentText: session.ytext.toString(),
      stateDeltaBase64: delta,
    });
  }

  const documents = await db.getDocuments(workspaceId);
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, document: docData, updateBase64, changeSummary } = body;

  if (action === 'create') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'document:create');
    if (auth instanceof NextResponse) return auth;

    const newDoc: Document = {
      ...docData,
      id: docData.id || crypto.randomUUID(),
      workspaceId,
      version: 1,
      authorId: user.id,
      author: user,
      lastEditedById: user.id,
      lastEditedBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    getOrCreateYDoc(newDoc.id, newDoc.rawText);
    await db.createDocument(newDoc, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_doc_created_${Date.now()}`,
      workspaceId,
      type: 'activity:logged',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: { action: 'created_document', documentId: newDoc.id, title: newDoc.title },
    });

    return NextResponse.json({ document: newDoc });
  }

  if (action === 'crdt_sync') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'document:edit');
    if (auth instanceof NextResponse) return auth;

    const { docId } = body;
    const existing = await db.getDocumentById(docId, workspaceId);
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const session = getOrCreateYDoc(docId, existing.rawText);

    if (updateBase64) {
      applyBase64Update(session.doc, updateBase64, 'remote_client');
      existing.rawText = session.ytext.toString();
      existing.contentDelta = encodeDocStateBase64(session.doc);
      await db.updateDocument(existing, user, changeSummary || 'CRDT Real-time update');

      // Broadcast binary delta to all other workspace collaborators
      realtimeHub.broadcast(workspaceId, {
        id: `evt_crdt_${Date.now()}`,
        workspaceId,
        type: 'crdt:update',
        senderId: user.id,
        senderName: user.name,
        timestamp: Date.now(),
        payload: {
          docId,
          updateBase64,
          rawText: existing.rawText,
        },
      });
    }

    return NextResponse.json({
      success: true,
      currentText: session.ytext.toString(),
      stateBase64: encodeDocStateBase64(session.doc),
    });
  }

  if (action === 'update_text') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'document:edit');
    if (auth instanceof NextResponse) return auth;

    const { docId, rawText, title } = body;
    const existing = await db.getDocumentById(docId, workspaceId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const session = getOrCreateYDoc(docId);
    session.doc.transact(() => {
      session.ytext.delete(0, session.ytext.length);
      session.ytext.insert(0, rawText);
    });

    existing.rawText = rawText;
    if (title) existing.title = title;
    const updated = await db.updateDocument(existing, user, changeSummary);

    return NextResponse.json({ document: updated });
  }

  return NextResponse.json({ error: 'Invalid document action' }, { status: 400 });
}
