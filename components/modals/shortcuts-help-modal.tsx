'use client';

import React from 'react';
import { Keyboard, X, Sparkles, CheckSquare, FileText, Search, RotateCcw, LayoutDashboard, Folder, Users, Paperclip } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickTask: () => void;
  onOpenSearch: () => void;
}

export function ShortcutsHelpModal({
  isOpen,
  onClose,
  onOpenQuickTask,
  onOpenSearch,
}: ShortcutsHelpModalProps) {
  const { t, setActiveView } = useWorkspace();

  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups = [
    {
      title: t.shortcuts.createSection,
      items: [
        {
          keys: ['C'],
          label: t.shortcuts.createTask,
          action: () => {
            onClose();
            onOpenQuickTask();
          },
          icon: CheckSquare,
        },
        {
          keys: ['D'],
          label: t.shortcuts.createDoc,
          action: () => {
            onClose();
            setActiveView('documents');
          },
          icon: FileText,
        },
        {
          keys: ['M'],
          label: t.nav.myWork || 'Моя работа & Фокус',
          action: () => {
            onClose();
            setActiveView('my-work');
          },
          icon: CheckSquare,
        },
      ],
    },
    {
      title: t.shortcuts.navSection,
      items: [
        {
          keys: [modKey, 'K'],
          label: t.shortcuts.searchPalette,
          action: () => {
            onClose();
            onOpenSearch();
          },
          icon: Search,
        },
        {
          keys: ['1'],
          label: t.shortcuts.viewOverview,
          action: () => {
            onClose();
            setActiveView('overview');
          },
          icon: LayoutDashboard,
        },
        {
          keys: ['2'],
          label: t.shortcuts.viewTasks,
          action: () => {
            onClose();
            setActiveView('tasks');
          },
          icon: CheckSquare,
        },
        {
          keys: ['3'],
          label: t.nav.timeline || 'Дорожная карта & Гант',
          action: () => {
            onClose();
            setActiveView('timeline');
          },
          icon: Sparkles,
        },
        {
          keys: ['4'],
          label: t.nav.sprints || 'Спринты & Burndown',
          action: () => {
            onClose();
            setActiveView('sprints');
          },
          icon: Sparkles,
        },
        {
          keys: ['5'],
          label: t.shortcuts.viewDocs,
          action: () => {
            onClose();
            setActiveView('documents');
          },
          icon: FileText,
        },
        {
          keys: ['6'],
          label: t.shortcuts.viewProjects,
          action: () => {
            onClose();
            setActiveView('projects');
          },
          icon: Folder,
        },
        {
          keys: ['7'],
          label: t.shortcuts.viewAi,
          action: () => {
            onClose();
            setActiveView('ai');
          },
          icon: Sparkles,
        },
        {
          keys: ['8'],
          label: t.shortcuts.viewFiles,
          action: () => {
            onClose();
            setActiveView('files');
          },
          icon: Paperclip,
        },
        {
          keys: ['9'],
          label: t.shortcuts.viewTeam,
          action: () => {
            onClose();
            setActiveView('team');
          },
          icon: Users,
        },
      ],
    },
    {
      title: t.shortcuts.actionSection,
      items: [
        {
          keys: [modKey, 'Z'],
          label: t.shortcuts.undoAction,
          icon: RotateCcw,
        },
        {
          keys: ['?'],
          label: t.shortcuts.openHelp,
          icon: Keyboard,
        },
        {
          keys: ['Esc'],
          label: t.shortcuts.closeModal,
          action: onClose,
          icon: X,
        },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">{t.shortcuts.title}</h3>
              <p className="text-2xs text-neutral-400">{t.shortcuts.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2.5">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-neutral-400">
                {group.title}
              </h4>
              <div className="grid grid-cols-1 gap-1.5">
                {group.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={iIdx}
                      onClick={item.action}
                      className={`flex items-center justify-between p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/60 transition-all ${
                        item.action
                          ? 'hover:border-neutral-700 hover:bg-neutral-800/50 cursor-pointer group'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-3.5 h-3.5 text-neutral-500 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-xs text-neutral-200 group-hover:text-neutral-100 font-medium">
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="min-w-[22px] h-5 px-1.5 flex items-center justify-center text-2xs font-mono font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-md shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Hint */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-2xs text-neutral-500">
          <span>{t.shortcuts.hint}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-2xs border border-neutral-700">
            Esc
          </kbd>
        </div>
      </div>
    </div>
  );
}
