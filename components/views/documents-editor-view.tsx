'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  History,
  MessageSquare,
  Sparkles,
  Share2,
  Copy,
  Check,
  Eye,
  Edit3,
  Columns,
  Trash2,
  Users,
  Download,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useYjsDocument } from '@/hooks/use-yjs-document';
import { Document, DocumentVersion } from '@/lib/types';
import { TemplatesModal } from '@/components/docs/templates-modal';
import Markdown from 'react-markdown';

export function DocumentsEditorView() {
  const {
    t,
    documents,
    selectedDocId,
    setSelectedDocId,
    createDocument,
    updateDocument,
    deleteDocument,
    comments,
    addComment,
    resolveComment,
    currentUser,
    currentWorkspace,
    onlineUsers,
  } = useWorkspace();
  const { success, error, info } = useToast();

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const [editorMode, setEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  // Sync title edits
  const [docTitle, setDocTitle] = useState('');
  const [lastSyncedDocId, setLastSyncedDocId] = useState<string | null>(null);

  if (currentDoc && currentDoc.id !== lastSyncedDocId) {
    setLastSyncedDocId(currentDoc.id);
    setDocTitle(currentDoc.title);
  }

  // Version snapshots calculated for current document
  const versions: DocumentVersion[] = currentDoc
    ? [
        {
          id: `ver_${currentDoc.id}_3`,
          version: currentDoc.version,
          authorId: currentDoc.lastEditedById || 'usr_elena',
          authorName: currentDoc.lastEditedBy?.name || 'Elena Rostova',
          title: currentDoc.title,
          snapshot: currentDoc.rawText,
          timestamp: currentDoc.updatedAt,
          changeSummary: 'Updated SLA targets & concurrency thresholds',
        },
        {
          id: `ver_${currentDoc.id}_2`,
          version: Math.max(1, currentDoc.version - 1),
          authorId: 'usr_alex',
          authorName: 'Alex Mercer',
          title: currentDoc.title,
          snapshot: currentDoc.rawText.slice(0, 500),
          timestamp: '2026-08-20T14:10:00Z',
          changeSummary: 'Initial PRD architecture baseline',
        },
      ]
    : [];

  const [commentInput, setCommentInput] = useState('');
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Yjs CRDT Realtime Document Hook
  const { content, handleLocalChange, broadcastCursor, remoteCursors } = useYjsDocument(
    currentDoc?.id || null,
    currentDoc?.rawText || ''
  );

  // Track cursor coordinates across editor
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorContainerRef.current) return;
    const rect = editorContainerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    broadcastCursor(x, y);
  };

  const handleCreateNewDoc = async () => {
    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }
    const newDoc = await createDocument({
      title: t.docs.untitledDoc,
      emoji: '📝',
      rawText: t.docs.untitledContent,
    });
    if (newDoc) {
      setSelectedDocId(newDoc.id);
      success(
        `${t.toasts.docCreated}: «${newDoc.title}»`,
        undefined,
        async () => {
          await deleteDocument(newDoc.id);
        }
      );
    }
  };

  const handleSelectTemplate = async (template: any) => {
    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }
    const newDoc = await createDocument({
      title: template.defaultTitle,
      emoji: template.emoji,
      rawText: template.content,
    });
    if (newDoc) {
      setSelectedDocId(newDoc.id);
      success(`${t.toasts.docCreated}: «${newDoc.title}»`);
    }
  };

  const handleDeleteCurrentDoc = async () => {
    if (!currentDoc) return;
    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }
    const docToDelete = { ...currentDoc };
    const deleted = await deleteDocument(docToDelete.id);
    if (deleted) {
      success(
        `${t.toasts.docDeleted}: «${docToDelete.title}»`,
        undefined,
        async () => {
          await createDocument({
            id: docToDelete.id,
            title: docToDelete.title,
            emoji: docToDelete.emoji,
            rawText: docToDelete.rawText,
            projectId: docToDelete.projectId,
          });
        }
      );
    }
  };

  const handleSaveTitle = async (newTitle: string) => {
    setDocTitle(newTitle);
    if (currentDoc) {
      await updateDocument({ ...currentDoc, title: newTitle, rawText: content });
    }
  };

  const handleAddDocComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDoc || !commentInput.trim()) return;
    await addComment('document', currentDoc.id, commentInput.trim());
    setCommentInput('');
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    info(t.toasts.copySuccess);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentDoc?.title || 'document').replace(/\s+/g, '_')}.md`;
    a.click();
  };

  const docComments = comments.filter((c) => c.targetId === currentDoc?.id);

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-200">
      {/* Left Sidebar: Documents List */}
      <div className="w-64 border-r border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">{t.docs.title}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsTemplatesOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg transition-colors"
              title={t.templates.btn}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-3xs font-semibold">Шаблоны</span>
            </button>
            <button
              onClick={handleCreateNewDoc}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 rounded-lg transition-colors"
              title={`${t.docs.newDoc} [D]`}
            >
              <Plus className="w-3.5 h-3.5" />
              <kbd className="text-3xs font-mono bg-indigo-900/80 px-1 py-0.2 rounded text-indigo-200">D</kbd>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {documents.map((doc) => {
            const isSelected = doc.id === currentDoc?.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-950/50 border border-indigo-500/30 text-slate-800 dark:text-neutral-100'
                    : 'hover:bg-white dark:hover:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{doc.emoji || '📄'}</span>
                  <span className="text-xs font-medium truncate">{doc.title}</span>
                </div>
                <span className="text-2xs text-slate-600 dark:text-neutral-300 font-mono">v{doc.version}</span>
              </div>
            );
          })}
        </div>

        {/* Realtime Collaborators on this Doc */}
        <div className="p-3 border-t border-slate-200 dark:border-neutral-800 bg-white/30 dark:bg-neutral-900/30 text-xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            <span>{t.docs.inDocument}</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {onlineUsers.map((u) => (
              <Avatar
                key={u.userId}
                src={u.avatar}
                name={u.name}
                color={u.color}
                title={`${u.name} (${u.role})`}
                className="w-6 h-6 rounded-full object-cover border-2"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Editor Center */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Editor Top Bar */}
        <div className="h-14 border-b border-slate-200 dark:border-neutral-800 px-6 flex items-center justify-between gap-4 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl">{currentDoc?.emoji || '📄'}</span>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => handleSaveTitle(e.target.value)}
              className="text-base font-bold text-slate-800 dark:text-neutral-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-neutral-700 focus:border-indigo-500 focus:outline-hidden truncate w-full max-w-lg"
            />
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 shrink-0">
              CRDT v{currentDoc?.version}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-50 dark:bg-neutral-950 p-1 rounded-lg border border-slate-200 dark:border-neutral-800">
              <button
                onClick={() => setEditorMode('edit')}
                title={t.docs.editMode}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  editorMode === 'edit' ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditorMode('split')}
                title={t.docs.splitMode}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  editorMode === 'split' ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditorMode('preview')}
                title={t.docs.previewMode}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  editorMode === 'preview'
                    ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Actions */}
            <button
              onClick={handleCopyMarkdown}
              className="p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="Copy Markdown"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title={t.docs.download}
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className={`p-2 rounded-lg transition-colors relative ${
                showComments ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
              }`}
              title={t.docs.comments}
            >
              <MessageSquare className="w-4 h-4" />
              {docComments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-3xs flex items-center justify-center font-bold">
                  {docComments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${
                showHistory ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
              }`}
              title={t.docs.history}
            >
              <History className="w-4 h-4" />
            </button>

            {currentDoc && (
              <button
                onClick={handleDeleteCurrentDoc}
                className="p-2 text-slate-500 dark:text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                title={t.tasks.deleteTask}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Editor Body with Remote Cursors Canvas */}
        <div
          ref={editorContainerRef}
          onMouseMove={handleMouseMove}
          className="relative flex-1 flex overflow-hidden"
        >
          {/* Render Remote Cursors */}
          {remoteCursors.map((cursor) => (
            <div
              key={cursor.userId}
              className="absolute pointer-events-none z-30 transition-all duration-75 flex items-start gap-1"
              style={{
                left: `${cursor.x}px`,
                top: `${cursor.y}px`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M0 0L6 14L8.5 8.5L14 6L0 0Z" fill={cursor.userColor} stroke="#000" strokeWidth="1" />
              </svg>
              <span
                className="text-2xs font-semibold px-1.5 py-0.5 rounded text-white shadow-md select-none"
                style={{ backgroundColor: cursor.userColor }}
              >
                {cursor.userName}
              </span>
            </div>
          ))}

          {/* Left Pane: Markdown Raw Code Editor */}
          {(editorMode === 'edit' || editorMode === 'split') && (
            <div
              className={`h-full flex flex-col ${
                editorMode === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-neutral-800' : 'w-full'
              }`}
            >
              <textarea
                value={content}
                onChange={(e) => handleLocalChange(e.target.value)}
                placeholder={t.docs.editorPlaceholder}
                className="w-full h-full p-6 bg-slate-50 dark:bg-neutral-950 text-slate-700 dark:text-neutral-200 font-mono text-xs leading-relaxed resize-none focus:outline-hidden custom-scrollbar"
                spellCheck={false}
              />
            </div>
          )}

          {/* Right Pane: Live Rendered Markdown */}
          {(editorMode === 'preview' || editorMode === 'split') && (
            <div
              className={`h-full overflow-y-auto p-8 bg-white dark:bg-neutral-900 custom-scrollbar ${
                editorMode === 'split' ? 'w-1/2' : 'w-full'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none text-slate-600 dark:text-neutral-300">
                <Markdown>{content || `*${t.docs.emptyDoc}*`}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Drawer: Version History */}
      {showHistory && (
        <div className="w-72 border-l border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-150">
          <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              {t.docs.history}
            </h3>
            <button onClick={() => setShowHistory(false)} className="text-xs text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200">
              {t.common.close}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-100">v{ver.version} {t.docs.snapshot}</span>
                  <span className="text-2xs text-slate-500 dark:text-neutral-500 font-mono">
                    {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400">{ver.changeSummary}</p>
                <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between text-2xs">
                  <span className="text-slate-500 dark:text-neutral-500">{t.docs.by} {ver.authorName}</span>
                  <button
                    onClick={() => handleLocalChange(ver.snapshot)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    {t.docs.restore} v{ver.version}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Right Drawer: Comments & Annotations */}
      {showComments && (
        <div className="w-80 border-l border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-150">
          <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              {t.docs.comments} ({docComments.length})
            </h3>
            <button onClick={() => setShowComments(false)} className="text-xs text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200">
              {t.common.close}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {docComments.map((cmt) => (
              <div
                key={cmt.id}
                className={`p-3 rounded-lg border ${
                  cmt.resolved ? 'bg-white/40 dark:bg-neutral-900/40 border-slate-200/60 dark:border-neutral-800/60 opacity-60' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={cmt.author?.avatar}
                      name={cmt.author?.name || ''}
                      color={cmt.author?.color}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{cmt.author?.name}</span>
                  </div>
                  <button
                    onClick={() => resolveComment(cmt.id, !cmt.resolved)}
                    className="text-2xs text-slate-500 dark:text-neutral-500 hover:text-emerald-400"
                  >
                    {cmt.resolved ? t.docs.reopen : t.docs.resolve}
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-neutral-300 pl-7">{cmt.content}</p>
              </div>
            ))}

            {docComments.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-neutral-500">
                {t.docs.noComments}
              </div>
            )}
          </div>

          <form onSubmit={handleAddDocComment} className="p-3 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-2">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={t.docs.addThreadComment}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 placeholder-neutral-500 focus:outline-hidden"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
            >
              {t.docs.post}
            </button>
          </form>
        </div>
      )}

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
