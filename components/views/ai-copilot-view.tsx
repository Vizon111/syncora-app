'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  CheckSquare,
  FileText,
  Paperclip,
  Folder,
  ArrowRight,
  ExternalLink,
  Info,
  HelpCircle,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { AiMessage, AiActionProposal, AiCitation, AiChatSession } from '@/lib/types';
import { AiActionModal } from '@/components/modals/ai-action-modal';
import { ChatSessionSidebar } from '@/components/ai/chat-session-sidebar';
import Markdown from 'react-markdown';

export function AiCopilotView() {
  const { t, language, currentWorkspace, currentUser, setActiveView, setSelectedDocId } = useWorkspace();
  
  const SUGGESTED_QUERIES = language === 'ru' ? [
    'Какие задачи по проекту Flowspace ещё не завершены?',
    'Выдели ключевые action items из PRD документа',
    'Почему для Flowspace выбран Yjs (CRDT) вместо Operational Transformation?',
    'Какая максимальная задержка (SLA) определена для синхронизации документов?',
    'Создай задачу для Alex Mercer: Оптимизировать кэширование Yjs state vectors',
  ] : [
    'Which tasks in Flowspace core are still pending?',
    'Extract key action items from the PRD document',
    'Why was Yjs (CRDT) selected over Operational Transformation?',
    'What is the maximum latency SLA defined for document sync?',
    'Create task for Alex Mercer: Optimize Yjs state vector caching',
  ];

  const INITIAL_MESSAGE: AiMessage = useMemo(
    () => ({
      id: 'msg_welcome',
      role: 'assistant',
      content: t.ai.welcomeMessage,
      createdAt: '2026-08-27T00:00:00.000Z',
    }),
    [t.ai.welcomeMessage]
  );

  const [messages, setMessages] = useState<AiMessage[]>([INITIAL_MESSAGE]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeProposal, setActiveProposal] = useState<AiActionProposal | null>(null);

  // Chat history / sessions — see components/ai/chat-session-sidebar.tsx.
  // activeSessionId is null until either the sidebar's "New chat" creates
  // one or the user picks a past session; the very first message of a
  // fresh conversation lazily creates the session (see handleSendPrompt)
  // rather than creating one on every mount, so idly opening the Copilot
  // tab doesn't spam empty sessions into the history list.
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch(`/api/ai/chat-sessions?workspaceId=${encodeURIComponent(currentWorkspace.id)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    // Wrapped in an IIFE (rather than calling the async loadSessions
    // directly in the effect body) so the React Compiler recognizes this
    // as the standard "fetch on mount" pattern rather than flagging a
    // synchronous setState-in-effect concern — loadSessions' setState
    // calls only run after the awaited fetch resolves, not synchronously
    // during this effect's execution.
    (async () => {
      await loadSessions();
    })();
  }, [loadSessions]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([INITIAL_MESSAGE]);
  }, [INITIAL_MESSAGE]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/ai/chat-sessions/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      const loaded: AiMessage[] = data.messages || [];
      setMessages(loaded.length > 0 ? loaded : [INITIAL_MESSAGE]);
    } catch {
      setMessages([INITIAL_MESSAGE]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [INITIAL_MESSAGE]);

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
    try {
      await fetch(`/api/ai/chat-sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    } catch {
      // Local state already updated optimistically; a failed rename here
      // is low-stakes enough (it'll just revert on next reload) not to
      // warrant a toast interrupting the chat.
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionId === activeSessionId) handleNewChat();
      try {
        await fetch(`/api/ai/chat-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      } catch {
        // Same reasoning as rename — reload will resync if this failed.
      }
    },
    [activeSessionId, handleNewChat]
  );

  const handleSendPrompt = React.useCallback(async (promptToSend?: string) => {
    const prompt = (promptToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    // Lazily create a session on the first message of a fresh conversation
    // — this is why activeSessionId starts null instead of being created
    // eagerly on mount (see the comment above its declaration).
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const res = await fetch('/api/ai/chat-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: currentWorkspace.id }),
        });
        const data = await res.json();
        if (data.session) {
          sessionId = data.session.id;
          setActiveSessionId(sessionId);
          setSessions((prev) => [data.session, ...prev]);
        }
      } catch {
        // If session creation fails, fall through and still answer the
        // question — sessionId stays null, so the exchange just won't be
        // persisted to history rather than blocking the chat entirely.
      }
    }

    const timestamp = new Date().toISOString();
    const userMessage: AiMessage = {
      id: `msg_user_${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: prompt,
      createdAt: timestamp,
    };

    // The assistant message is created up front (empty) and appended to as
    // deltas arrive, rather than only being added once the full response is
    // known — that's what makes the text appear incrementally.
    const assistantMessageId = `msg_ai_${Math.random().toString(36).substring(2, 9)}`;
    const assistantMessage: AiMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    if (!promptToSend) setInputPrompt('');
    setIsLoading(true);

    const appendToAssistant = (patch: Partial<AiMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessageId ? { ...m, ...patch } : m))
      );
    };

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          prompt,
          history,
          sessionId,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; split and keep any
        // trailing partial frame in the buffer for the next chunk.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice('data:'.length).trim();
          if (!jsonStr) continue;

          let event: { type: string; text?: string; citations?: AiCitation[]; actionProposal?: AiActionProposal | null; message?: string };
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (event.type === 'delta' && event.text) {
            accumulatedText += event.text;
            appendToAssistant({ content: accumulatedText });
          } else if (event.type === 'done') {
            appendToAssistant({
              content: accumulatedText || t.ai.notFound,
              citations: event.citations || [],
              actionProposal: event.actionProposal || undefined,
            });
          } else if (event.type === 'error') {
            appendToAssistant({ content: event.message || t.ai.errorMsg });
          }
        }
      }
    } catch {
      appendToAssistant({ content: t.ai.errorMsg });
    } finally {
      setIsLoading(false);
      if (sessionId) loadSessions();
    }
  }, [inputPrompt, isLoading, messages, activeSessionId, currentUser.id, currentWorkspace.id, t.ai.notFound, t.ai.errorMsg, loadSessions]);

  const handleCitationClick = (citation: AiCitation) => {
    if (citation.sourceType === 'document') {
      setSelectedDocId(citation.sourceId);
      setActiveView('documents');
    } else if (citation.sourceType === 'task') {
      setActiveView('tasks');
    } else if (citation.sourceType === 'project') {
      setActiveView('projects');
    } else if (citation.sourceType === 'file') {
      setActiveView('files');
    }
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] w-full animate-in fade-in duration-200">
      <ChatSessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingSessions}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
        onRename={handleRenameSession}
        onDelete={handleDeleteSession}
      />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6 min-w-0">
      {/* Top Banner: Tenant Knowledge Grounding Info */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-2">
              {t.ai.title}
              <span className="text-2xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {t.ai.tenantIsolated} {currentWorkspace.name}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              {t.ai.subtitle}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-2xs text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{t.ai.antiHallucination}</span>
        </div>
      </div>

      {isLoadingMessages ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : (
      <>
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 mb-4">
        {messages.map((msg) => {
          const isAi = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                  isAi
                    ? 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 shadow-md'
                    : 'bg-indigo-600 text-white rounded-tr-xs shadow-lg shadow-indigo-600/20'
                }`}
              >
                <div className="prose prose-invert prose-xs max-w-none">
                  <Markdown>{msg.content}</Markdown>
                </div>

                {/* Citations Box */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-neutral-800/80 space-y-2">
                    <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                      {t.ai.groundedSources} ({msg.citations.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.citations.map((cit) => (
                        <div
                          key={cit.id}
                          onClick={() => handleCitationClick(cit)}
                          className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/80 dark:bg-neutral-950/80 border border-slate-200 dark:border-neutral-800 hover:border-indigo-500/40 cursor-pointer transition-colors group"
                        >
                          <div className="mt-0.5 text-slate-500 dark:text-neutral-400 group-hover:text-indigo-400">
                            {cit.sourceType === 'document' && <FileText className="w-3.5 h-3.5" />}
                            {cit.sourceType === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                            {cit.sourceType === 'project' && <Folder className="w-3.5 h-3.5" />}
                            {cit.sourceType === 'file' && <Paperclip className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-700 dark:text-neutral-200 block truncate group-hover:text-indigo-300">
                              {cit.sourceTitle}
                            </span>
                            <span className="text-3xs text-slate-500 dark:text-neutral-500 line-clamp-1 italic">{cit.snippet}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Proposal Card */}
                {msg.actionProposal && (
                  <div className="mt-3.5 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                        <CheckSquare className="w-4 h-4" />
                        <span>{t.ai.actionProposal}: {msg.actionProposal.title}</span>
                      </div>
                      <button
                        onClick={() => setActiveProposal(msg.actionProposal || null)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-2xs transition-colors shadow-md"
                      >
                        {t.ai.reviewApply}
                      </button>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-neutral-400 mt-1">{msg.actionProposal.description}</p>
                  </div>
                )}
              </div>

              {!isAi && (
                <Avatar
                  src={currentUser.avatar}
                  name={currentUser.name}
                  color={currentUser.color}
                  className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-neutral-700 shrink-0 mt-0.5"
                />
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400 pl-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>{t.ai.searchingIndex}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Queries Chips */}
      {messages.length < 3 && (
        <div className="mb-3">
          <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-2">
            {t.ai.suggestedPrompts}
          </span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSendPrompt(sq)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-indigo-500/40 hover:bg-slate-100 dark:hover:bg-neutral-850 rounded-lg text-left transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt();
        }}
        className="relative bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-2 focus-within:border-indigo-500/80 transition-colors shadow-lg"
      >
        <textarea
          rows={2}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt();
            }
          }}
          placeholder={t.ai.inputPlaceholder}
          className="w-full bg-transparent text-xs text-slate-800 dark:text-neutral-100 placeholder-neutral-500 px-3 py-1.5 resize-none focus:outline-hidden custom-scrollbar"
        />

        <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-200/60 dark:border-neutral-800/60">
          <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-neutral-500">
            <span>{t.ai.poweredBy}</span>
          </div>

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-md disabled:opacity-40"
          >
            <span>{t.ai.askButton}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
      </>
      )}
      </div>

      {/* Action Confirmation Modal */}
      <AiActionModal proposal={activeProposal} onClose={() => setActiveProposal(null)} />
    </div>
  );
}
