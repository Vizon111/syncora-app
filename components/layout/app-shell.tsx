'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Folder,
  Sparkles,
  Paperclip,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Plus,
  Zap,
  Command,
  Calendar,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { OverviewView } from '@/components/views/overview-view';
import { MyWorkView } from '@/components/views/my-work-view';
import { TasksKanbanView } from '@/components/views/tasks-kanban-view';
import { GanttTimelineView } from '@/components/views/gantt-timeline-view';
import { SprintsView } from '@/components/views/sprints-view';
import { DocumentsEditorView } from '@/components/views/documents-editor-view';
import { AiCopilotView } from '@/components/views/ai-copilot-view';
import { FilesView } from '@/components/views/files-view';
import { TeamRolesView } from '@/components/views/team-roles-view';
import { ProjectsView } from '@/components/views/projects-view';
import { SettingsView } from '@/components/views/settings-view';
import { ProfileView } from '@/components/views/profile-view';
import { NotificationsPopover } from '@/components/notifications/notifications-popover';
import { SearchModal } from '@/components/modals/search-modal';
import { QuickTaskModal } from '@/components/modals/quick-task-modal';
import { ShortcutsHelpModal } from '@/components/modals/shortcuts-help-modal';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

const SIDEBAR_COLLAPSED_WIDTH = 'w-[68px]';
const SIDEBAR_EXPANDED_WIDTH = 'w-64';

export function AppShell() {
  const {
    t,
    currentWorkspace,
    workspaces,
    currentUser,
    onlineUsers,
    connectionStatus,
    activeView,
    setActiveView,
    switchWorkspace,
  } = useWorkspace();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Sidebar starts collapsed (icon rail only). Hovering expands it
  // temporarily; pinning keeps it expanded regardless of hover.
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;

  // Hook for global keyboard shortcuts (C, D, Cmd+K, ?, 1-7, Cmd+Z)
  useGlobalShortcuts({
    onOpenQuickTask: () => setIsQuickTaskOpen(true),
    onOpenSearch: () => setIsSearchOpen(true),
    onOpenShortcutsHelp: () => setIsShortcutsHelpOpen(true),
    isModalOpen: isSearchOpen || isQuickTaskOpen || isShortcutsHelpOpen,
  });

  const navItems = [
    { id: 'overview', label: t.nav.overview, icon: LayoutDashboard },
    { id: 'my-work', label: t.nav.myWork || 'Моя работа', icon: CheckCircle2 },
    { id: 'tasks', label: t.nav.tasks, icon: CheckSquare },
    { id: 'timeline', label: t.nav.timeline || 'Дорожная карта & Гант', icon: Calendar },
    { id: 'sprints', label: t.nav.sprints || 'Спринты & Burndown', icon: Zap },
    { id: 'documents', label: t.nav.documents, icon: FileText },
    { id: 'projects', label: t.nav.projects, icon: Folder },
    { id: 'ai', label: t.nav.ai, icon: Sparkles, highlight: true },
    { id: 'files', label: t.nav.files, icon: Paperclip },
    { id: 'team', label: t.nav.team, icon: Users },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-neutral-950 dark:text-neutral-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation — collapsed to an icon rail by default, expands
          on hover or when pinned open via the button in the header row. */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => {
          setIsSidebarHovered(false);
          if (!isSidebarPinned) setIsWorkspaceMenuOpen(false);
        }}
        className={`${
          isSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH
        } bg-slate-50 border-r border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 flex flex-col shrink-0 transition-[width] duration-200 ease-out overflow-hidden z-30`}
      >
        {/* Brand & Workspace Switcher */}
        <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-1">
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => isSidebarExpanded && setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700 transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30 shrink-0">
                  {currentWorkspace.avatar || '✨'}
                </div>
                {isSidebarExpanded && (
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-neutral-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                      {currentWorkspace.name}
                    </h2>
                    <span className="text-2xs text-slate-500 dark:text-neutral-500 block capitalize font-mono">
                      {currentWorkspace.plan === 'pro' ? t.common.proPlan : currentWorkspace.plan === 'enterprise' ? t.common.enterprisePlan : t.common.freePlan}
                    </span>
                  </div>
                )}
              </div>
              {isSidebarExpanded && (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:text-neutral-500 dark:group-hover:text-neutral-300 shrink-0" />
              )}
            </button>

            {/* Workspace Dropdown */}
            {isWorkspaceMenuOpen && isSidebarExpanded && (
              <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-white border border-slate-200 shadow-2xl dark:bg-neutral-900 dark:border-neutral-800 z-50 animate-in fade-in zoom-in-95">
                <span className="text-3xs font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider px-2 py-1 block">
                  {t.common.switchWorkspace}
                </span>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      ws.id === currentWorkspace.id
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-sm">{ws.avatar || '📁'}</span>
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pin/unpin sidebar open button — only worth showing once expanded */}
          {isSidebarExpanded && (
            <button
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              title={isSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-neutral-500 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              {isSidebarPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
          {/* Quick Create Task button */}
          <div className="pb-2 mb-1.5 border-b border-slate-200 dark:border-neutral-800/80">
            <button
              onClick={() => setIsQuickTaskOpen(true)}
              title={t.overview.createTask}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-600/15 dark:text-indigo-300 dark:border-indigo-500/30 dark:hover:bg-indigo-600/25 dark:hover:text-white transition-all group"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-500 dark:text-indigo-400 group-hover:rotate-90 transition-transform duration-200 shrink-0" />
                {isSidebarExpanded && <span className="whitespace-nowrap">{t.overview.createTask}</span>}
              </div>
              {isSidebarExpanded && (
                <kbd className="px-1.5 py-0.5 text-3xs font-mono font-bold bg-indigo-100 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800/80 rounded">
                  C
                </kbd>
              )}
            </button>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? item.highlight
                      ? 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-300 dark:from-indigo-600/30 dark:to-purple-600/30 dark:text-indigo-300 dark:border-indigo-500/40 shadow-inner'
                      : 'bg-slate-200/80 text-slate-900 font-semibold border border-slate-300/60 dark:bg-neutral-800/90 dark:text-neutral-100 dark:border-neutral-700/60'
                    : item.highlight
                    ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? item.highlight
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-900 dark:text-neutral-100'
                        : item.highlight
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-neutral-500'
                    }`}
                  />
                  {isSidebarExpanded && <span className="whitespace-nowrap">{item.label}</span>}
                </div>

                {isSidebarExpanded && item.highlight && (
                  <span className="text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    {t.nav.aiTag}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: Settings + Realtime Status + Account */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/60 dark:border-neutral-800 dark:bg-neutral-950/60 space-y-2">
          <button
            onClick={() => setActiveView('settings')}
            title={t.common.settings}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-2xs transition-colors ${
              activeView === 'settings'
                ? 'bg-slate-200/80 text-slate-900 font-semibold border border-slate-300/60 dark:bg-neutral-800/90 dark:text-neutral-100 dark:border-neutral-700/60'
                : 'bg-white/60 border border-slate-200/80 hover:bg-slate-100 hover:border-slate-300 dark:bg-neutral-900/60 dark:border-neutral-800/80 dark:hover:bg-neutral-800 dark:hover:border-neutral-700 text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {isSidebarExpanded && <span className="whitespace-nowrap">{t.common.settings}</span>}
          </button>

          {isSidebarExpanded && (
            <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-neutral-400 px-1 pt-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : connectionStatus === 'reconnecting'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="font-mono capitalize">
                  {connectionStatus === 'connected' ? t.common.connected : connectionStatus === 'reconnecting' ? t.common.reconnecting : t.common.offline}
                </span>
              </div>
              <span className="text-slate-400 dark:text-neutral-500 font-mono">v1.0-prod</span>
            </div>
          )}

          {/* Account block — click through to the full Profile page */}
          <button
            onClick={() => setActiveView('profile')}
            title={currentUser.name}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border ${
              activeView === 'profile'
                ? 'bg-slate-200/80 border-slate-300/60 dark:bg-neutral-800/90 dark:border-neutral-700/60'
                : 'border-transparent hover:bg-slate-100 dark:hover:bg-neutral-900'
            }`}
          >
            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              color={currentUser.color}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-neutral-700 shrink-0"
            />
            {isSidebarExpanded && (
              <div className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-neutral-200">
                  {currentUser.name}
                </span>
                <span className="block truncate text-3xs text-slate-500 dark:text-neutral-500">
                  {currentUser.email}
                </span>
              </div>
            )}
            {isSidebarExpanded && <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white/40 dark:bg-neutral-900/40">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200 bg-slate-50/80 dark:border-neutral-800 dark:bg-neutral-950/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0 z-20">
          {/* Quick Search Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700 text-xs text-slate-500 dark:text-neutral-400 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:text-neutral-500 dark:group-hover:text-neutral-300" />
                <span className="group-hover:text-slate-700 dark:group-hover:text-neutral-300">{t.common.search}</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-mono text-slate-500 bg-slate-100 border border-slate-200 dark:text-neutral-500 dark:bg-neutral-800 dark:border-neutral-700 rounded">
                <Command className="w-3 h-3" />K
              </kbd>
            </button>
          </div>

          {/* Right Header: Active Peers & Notifications */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Active Online Peers Avatar Cluster */}
            <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-neutral-800">
              <span className="text-2xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider mr-1">{t.common.collaborators}</span>
              <div className="flex -space-x-2 overflow-hidden">
                {onlineUsers.map((peer) => (
                  <Avatar
                    key={peer.userId}
                    src={peer.avatar}
                    name={peer.name}
                    color={peer.color}
                    title={`${peer.name} (${peer.role})`}
                    className="inline-block h-7 w-7 rounded-full ring-2 ring-slate-50 dark:ring-neutral-950 object-cover"
                  />
                ))}
              </div>
            </div>

            {/* Notification Center Popover */}
            <NotificationsPopover />
          </div>
        </header>

        {/* Dynamic View Component */}
        <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-8">
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'my-work' && <MyWorkView />}
          {activeView === 'tasks' && <TasksKanbanView />}
          {activeView === 'timeline' && <GanttTimelineView />}
          {activeView === 'sprints' && <SprintsView />}
          {activeView === 'documents' && <DocumentsEditorView />}
          {activeView === 'projects' && <ProjectsView />}
          {activeView === 'ai' && <AiCopilotView />}
          {activeView === 'files' && <FilesView />}
          {activeView === 'team' && <TeamRolesView />}
          {activeView === 'settings' && <SettingsView onOpenShortcuts={() => setIsShortcutsHelpOpen(true)} />}
          {activeView === 'profile' && <ProfileView />}
        </main>
      </div>

      {/* Global Command Palette Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenQuickTask={() => setIsQuickTaskOpen(true)}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      {/* Global Quick Task Creation Modal [C] */}
      <QuickTaskModal
        isOpen={isQuickTaskOpen}
        onClose={() => setIsQuickTaskOpen(false)}
      />

      {/* Keyboard Shortcuts Reference Cheat Sheet Modal [?] */}
      <ShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
        onOpenQuickTask={() => setIsQuickTaskOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
    </div>
  );
}
