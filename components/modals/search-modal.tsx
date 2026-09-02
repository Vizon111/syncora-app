'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  FileText,
  CheckSquare,
  Folder,
  Paperclip,
  X,
  CornerDownLeft,
  Sparkles,
  Keyboard,
  Globe,
  Users,
  LayoutDashboard,
  Zap,
} from 'lucide-react';
import { SearchResult } from '@/lib/types';
import { useWorkspace } from '@/hooks/use-workspace-context';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickTask?: () => void;
  onOpenShortcutsHelp?: () => void;
}

export function SearchModal({
  isOpen,
  onClose,
  onOpenQuickTask,
  onOpenShortcutsHelp,
}: SearchModalProps) {
  const {
    t,
    language,
    setLanguage,
    currentWorkspace,
    setActiveView,
    setSelectedDocId,
    setSelectedProjectId,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickCommands = useMemo(() => [
    {
      id: 'cmd_new_task',
      title: t.commands.createNewTask,
      subtitle: t.shortcuts.createTask,
      badge: 'C',
      icon: CheckSquare,
      color: 'text-emerald-400',
      action: () => {
        onClose();
        if (onOpenQuickTask) onOpenQuickTask();
      },
    },
    {
      id: 'cmd_new_doc',
      title: t.commands.createNewDoc,
      subtitle: t.shortcuts.createDoc,
      badge: 'D',
      icon: FileText,
      color: 'text-indigo-400',
      action: () => {
        setActiveView('documents');
        onClose();
      },
    },
    {
      id: 'cmd_my_work',
      title: t.nav.myWork || 'Моя работа & Фокус',
      subtitle: 'Персональный фокус, таймер Pomodoro и личные задачи',
      badge: 'M',
      icon: CheckSquare,
      color: 'text-amber-400',
      action: () => {
        setActiveView('my-work');
        onClose();
      },
    },
    {
      id: 'cmd_switch_lang',
      title: t.commands.switchLang,
      subtitle:
        language === 'ru'
          ? 'Текущий: Русский → Switch to English / Español'
          : language === 'en'
          ? 'Current: English → Switch to Español / Русский'
          : 'Actual: Español → Switch to Русский / English',
      badge: 'L',
      icon: Globe,
      color: 'text-cyan-400',
      action: () => {
        const nextLang = language === 'ru' ? 'en' : language === 'en' ? 'es' : 'ru';
        setLanguage(nextLang);
        onClose();
      },
    },
    {
      id: 'cmd_shortcuts_help',
      title: t.commands.showShortcuts,
      subtitle: t.shortcuts.subtitle,
      badge: '?',
      icon: Keyboard,
      color: 'text-amber-400',
      action: () => {
        onClose();
        if (onOpenShortcutsHelp) onOpenShortcutsHelp();
      },
    },
    {
      id: 'cmd_open_tasks',
      title: t.commands.openKanban,
      subtitle: t.shortcuts.viewTasks,
      badge: '2',
      icon: LayoutDashboard,
      color: 'text-blue-400',
      action: () => {
        setActiveView('tasks');
        onClose();
      },
    },
    {
      id: 'cmd_open_sprints',
      title: t.sprints.title || 'Спринты и Burndown',
      subtitle: t.sprints.subtitle || 'Спринты, скорость и графики сгорания',
      badge: '3',
      icon: Zap,
      color: 'text-amber-400',
      action: () => {
        setActiveView('sprints');
        onClose();
      },
    },
    {
      id: 'cmd_open_ai',
      title: t.commands.openAi,
      subtitle: t.shortcuts.viewAi,
      badge: '6',
      icon: Sparkles,
      color: 'text-purple-400',
      action: () => {
        setActiveView('ai');
        onClose();
      },
    },
  ], [t, language, setLanguage, setActiveView, onClose, onOpenQuickTask, onOpenShortcutsHelp]);

  const filteredCommands = useMemo(() => query
    ? quickCommands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : quickCommands, [query, quickCommands]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.type === 'document') {
        setSelectedDocId(item.id);
        setActiveView('documents');
      } else if (item.type === 'task') {
        setActiveView('tasks');
      } else if (item.type === 'project') {
        setSelectedProjectId(item.id);
        setActiveView('projects');
      } else if (item.type === 'file') {
        setActiveView('files');
      }
      onClose();
    },
    [setSelectedDocId, setActiveView, setSelectedProjectId, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      const timer = setTimeout(() => {
        setResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/search?workspaceId=${currentWorkspace.id}&q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, currentWorkspace.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const totalItems = query ? results.length + filteredCommands.length : quickCommands.length;

      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (query && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        } else if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, filteredCommands, quickCommands, query, selectedIndex, handleSelect, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div
        id="flowspace-search-modal"
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-800 gap-3 bg-neutral-950/60">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.common.searchPlaceholder}
            className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 text-sm focus:outline-hidden font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-neutral-400 hover:text-neutral-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-2xs font-mono text-neutral-400 bg-neutral-800 border border-neutral-700 rounded shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Search Results / Commands List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {isSearching && (
            <div className="py-8 text-center text-xs text-neutral-500">{t.common.loading}</div>
          )}

          {/* Quick Commands list */}
          {filteredCommands.length > 0 && (!query || query.length < 3) && (
            <div className="space-y-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-neutral-500 px-2 block">
                {t.commands.quickCommands}
              </span>
              <div className="grid grid-cols-1 gap-1">
                {filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = !query && idx === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/40 text-neutral-100'
                          : 'border-neutral-800/60 bg-neutral-950/50 hover:bg-neutral-800/60 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg bg-neutral-800 ${cmd.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-neutral-200">{cmd.title}</p>
                          <p className="text-2xs text-neutral-400">{cmd.subtitle}</p>
                        </div>
                      </div>

                      <kbd className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-2xs font-mono font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 rounded shadow-xs">
                        {cmd.badge}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isSearching && query && results.length === 0 && filteredCommands.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-neutral-300">
                {t.common.noResults} &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {language === 'ru'
                  ? 'Попробуйте ключевые слова, название задачи или файла.'
                  : 'Try searching by keyword, document name, or task title.'}
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-neutral-500 px-2 block">
                {language === 'ru' ? 'Результаты поиска' : 'Search Results'} ({results.length})
              </span>
              <div className="space-y-1">
                {results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/40 shadow-xs'
                          : 'border-transparent hover:border-neutral-800 hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="mt-0.5 p-2 rounded-lg bg-neutral-800 text-neutral-300 group-hover:text-indigo-400 transition-colors">
                        {item.type === 'document' && <FileText className="w-4 h-4 text-indigo-400" />}
                        {item.type === 'task' && <CheckSquare className="w-4 h-4 text-emerald-400" />}
                        {item.type === 'project' && <Folder className="w-4 h-4 text-amber-400" />}
                        {item.type === 'file' && <Paperclip className="w-4 h-4 text-cyan-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-neutral-100 truncate">
                            {item.title}
                          </h4>
                          <span className="text-2xs uppercase tracking-wider text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-800 font-mono">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-2xs text-neutral-400 mt-0.5 truncate">{item.subtitle}</p>
                        {item.snippet && (
                          <p className="text-2xs text-neutral-500 mt-1 line-clamp-1 italic font-mono bg-neutral-950/80 p-1.5 rounded-md border border-neutral-800/60">
                            {item.snippet}
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <div className="self-center flex items-center gap-1 text-indigo-400 text-xs shrink-0 font-medium">
                          <span>{language === 'ru' ? 'Перейти' : 'Jump'}</span>
                          <CornerDownLeft className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-2xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-neutral-800 font-mono text-neutral-400">↑↓</kbd>
              <span>{language === 'ru' ? 'навигация' : 'navigate'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-neutral-800 font-mono text-neutral-400">↵</kbd>
              <span>{language === 'ru' ? 'выбрать' : 'select'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-neutral-800 font-mono text-neutral-400">[?]</kbd>
              <span>{language === 'ru' ? 'все клавиши' : 'all shortcuts'}</span>
            </span>
          </div>
          <span className="font-mono">{currentWorkspace.name}</span>
        </div>
      </div>
    </div>
  );
}

