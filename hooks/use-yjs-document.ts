'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { useWorkspace } from './use-workspace-context';
import { RemoteCursor } from '@/lib/types';

export function useYjsDocument(docId: string | null, initialContent = '') {
  const { currentUser, currentWorkspace, broadcastEvent } = useWorkspace();
  const [content, setContent] = useState(initialContent);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [isSyncing, setIsSyncing] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const isLocalUpdateRef = useRef(false);

  // Initialize Yjs Document
  useEffect(() => {
    if (!docId) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    if (initialContent) {
      ydoc.transact(() => {
        ytext.insert(0, initialContent);
      });
    }

    // Observer for Yjs changes
    const observer = () => {
      if (!isLocalUpdateRef.current) {
        setContent(ytext.toString());
      }
    };

    ytext.observe(observer);

    // Initial server fetch of binary delta
    fetch(`/api/documents?workspaceId=${currentWorkspace.id}&docId=${docId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.document && data.currentText) {
          if (ytext.toString() !== data.currentText) {
            ydoc.transact(() => {
              ytext.delete(0, ytext.length);
              ytext.insert(0, data.currentText);
            });
            setContent(data.currentText);
          }
        }
      })
      .catch(() => {});

    return () => {
      ytext.unobserve(observer);
      ydoc.destroy();
    };
  }, [docId, currentWorkspace.id, initialContent]);

  // Handle local text edits
  const handleLocalChange = useCallback(
    (newText: string) => {
      if (!ydocRef.current || !ytextRef.current || !docId) return;

      const ydoc = ydocRef.current;
      const ytext = ytextRef.current;
      const oldText = ytext.toString();

      if (newText === oldText) return;

      isLocalUpdateRef.current = true;
      setContent(newText);

      // Perform Yjs transaction
      ydoc.transact(() => {
        // Simple replace or delta
        ytext.delete(0, ytext.length);
        ytext.insert(0, newText);
      });

      // Encode state as base64 delta
      const update = Y.encodeStateAsUpdate(ydoc);
      const updateBase64 = Buffer.from(update).toString('base64');

      // Send to server and peers
      fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crdt_sync',
          workspaceId: currentWorkspace.id,
          docId,
          updateBase64,
        }),
      }).catch(() => {});

      broadcastEvent('crdt:update', {
        docId,
        updateBase64,
        rawText: newText,
      });

      setTimeout(() => {
        isLocalUpdateRef.current = false;
      }, 50);
    },
    [docId, currentWorkspace.id, currentUser.id, broadcastEvent]
  );

  // Broadcast cursor movements
  const broadcastCursor = useCallback(
    (x: number, y: number, selection?: { start: number; end: number }) => {
      if (!docId) return;

      const cursor: RemoteCursor = {
        userId: currentUser.id,
        userName: currentUser.name,
        userColor: currentUser.color,
        userAvatar: currentUser.avatar,
        x,
        y,
        selection,
        lastUpdated: Date.now(),
      };

      broadcastEvent('crdt:cursor', {
        docId,
        cursor,
      });
    },
    [docId, currentUser, broadcastEvent]
  );

  // Listen for remote peer updates & cursors
  useEffect(() => {
    const handleRemoteSync = (e: any) => {
      const data = e.detail || e;
      if (!data || !docId) return;

      if (data.type === 'crdt:update' && data.payload?.docId === docId) {
        if (data.senderId === currentUser.id) return; // Skip own updates
        const { updateBase64, rawText } = data.payload;

        if (ydocRef.current && updateBase64) {
          try {
            const binary = Buffer.from(updateBase64, 'base64');
            Y.applyUpdate(ydocRef.current, binary, 'remote');
            setContent(ytextRef.current?.toString() || rawText);
          } catch {
            if (rawText) setContent(rawText);
          }
        } else if (rawText) {
          setContent(rawText);
        }
      }

      if (data.type === 'crdt:cursor' && data.payload?.docId === docId) {
        if (data.senderId === currentUser.id) return;
        const cursor: RemoteCursor = data.payload.cursor;
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(cursor.userId, cursor);
          return next;
        });
      }
    };

    window.addEventListener('flowspace:crdt' as any, handleRemoteSync);
    return () => {
      window.removeEventListener('flowspace:crdt' as any, handleRemoteSync);
    };
  }, [docId, currentUser.id]);

  return {
    content,
    handleLocalChange,
    broadcastCursor,
    remoteCursors: Array.from(remoteCursors.values()).filter(
      (c) => c.userId !== currentUser.id
    ),
    isSyncing,
  };
}
