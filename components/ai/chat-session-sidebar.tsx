'use client';

import React, { useState } from 'react';
import { Plus, MessageSquare, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { AiChatSession } from '@/lib/types';

interface ChatSessionSidebarProps {
  sessions: AiChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

function groupSessionsByRecency(sessions: AiChatSession[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  const groups: { label: string; sessions: AiChatSession[] }[] = [
    { label: 'Today', sessions: [] },
    { label: 'Yesterday', sessions: [] },
    { label: 'Earlier', sessions: [] },
  ];

  for (const session of sessions) {
    const updated = new Date(session.updatedAt);
    if (updated >= startOfToday) groups[0].sessions.push(session);
    else if (updated >= startOfYesterday) groups[1].sessions.push(session);
    else groups[2].sessions.push(session);
  }

  return groups.filter((g) => g.sessions.length > 0);
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  isLoading,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: ChatSessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (session: AiChatSession) => {
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const groups = groupSessionsByRecency(sessions);

  return (
    <div className="w-64 shrink-0 border-r border-slate-200 dark:border-neutral-800 flex flex-col h-full bg-slate-50/60 dark:bg-neutral-950/60">
      <div className="p-3 border-b border-slate-200 dark:border-neutral-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-2xs text-slate-400 dark:text-neutral-600 text-center py-6 px-2">
            No past conversations yet — your chat history will show up here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-600 px-2 block">
                {group.label}
              </span>
              {group.sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isEditing = editingId === session.id;

                if (isEditing) {
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-indigo-400"
                    >
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 min-w-0 bg-transparent text-xs text-slate-800 dark:text-neutral-100 focus:outline-none"
                      />
                      <button onClick={commitEdit} className="p-1 text-emerald-500 hover:text-emerald-400 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelect(session.id)}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 min-w-0 truncate">{session.title}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(session);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(session.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
