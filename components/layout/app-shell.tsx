'use client';

import React, { useState, useEffect } from 'react';
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
  Activity,
  Plus,
  Shield,
  Zap,
  Layers,
  LogOut,
  Command,
  Calendar,
  CheckCircle2,
  Bell,
  Keyboard,
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
import { NotificationsPopover } from '@/components/notifications/notifications-popover';
import { SearchModal } from '@/components/modals/search-modal';
import { QuickTaskModal } from '@/components/modals/quick-task-modal';
import { ShortcutsHelpModal } from '@/components/modals/shortcuts-help-modal';
import { SettingsModal } from '@/components/modals/settings-modal';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

export function AppShell() {
  const {
    t,
    currentWorkspace,
    workspaces,
    currentUser,
    allUsers,
    onlineUsers,
    connectionStatus,
    activeView,
    setActiveView,
    switchWorkspace,
    signOut,
  } = useWorkspace();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
        {/* Brand & Workspace Switcher */}
        <div className="p-4 border-b border-neutral-800">
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30 shrink-0">
                  {currentWorkspace.avatar || '✨'}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-bold text-neutral-100 truncate group-hover:text-indigo-300 transition-colors">
                    {currentWorkspace.name}
                  </h2>
                  <span className="text-2xs text-neutral-500 block capitalize font-mono">
                    {currentWorkspace.plan === 'pro' ? t.common.proPlan : currentWorkspace.plan === 'enterprise' ? t.common.enterprisePlan : t.common.freePlan}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            </button>

            {/* Workspace Dropdown */}
            {isWorkspaceMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <span className="text-3xs font-bold text-neutral-500 uppercase tracking-wider px-2 py-1 block">
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
                        ? 'bg-indigo-950/60 text-indigo-400 font-semibold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-sm">{ws.avatar || '📁'}</span>
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {/* Quick Create Task button */}
          <div className="pb-2 mb-1.5 border-b border-neutral-800/80">
            <button
              onClick={() => setIsQuickTaskOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/25 hover:text-white transition-all group"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400 group-hover:rotate-90 transition-transform duration-200" />
                <span>{t.overview.createTask}</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-3xs font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 rounded">
                C
              </kbd>
            </button>
          </div>

          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? item.highlight
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-indigo-300 border border-indigo-500/40 shadow-inner'
                      : 'bg-neutral-800/90 text-neutral-100 font-semibold border border-neutral-700/60'
                    : item.highlight
                    ? 'text-indigo-400 hover:bg-indigo-950/30'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? item.highlight
                          ? 'text-indigo-400'
                          : 'text-neutral-100'
                        : item.highlight
                        ? 'text-indigo-400'
                        : 'text-neutral-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {item.highlight ? (
                    <span className="text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {t.nav.aiTag}
                    </span>
                  ) : (
                    <span className="text-3xs font-mono text-neutral-600 group-hover:text-neutral-400 hidden sm:inline">
                      {idx + 1}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Tenant / Realtime Status */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 space-y-2">
          <button
            onClick={() => setIsShortcutsHelpOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-2xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t.shortcuts.title}</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-3xs border border-neutral-700">
              ?
            </kbd>
          </button>

          <div className="flex items-center justify-between text-2xs text-neutral-400 pt-1">
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
            <span className="text-neutral-500 font-mono">v1.0-prod</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-neutral-900/40">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0 z-20">
          {/* Quick Search Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-400 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                <span className="group-hover:text-neutral-300">{t.common.search}</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-mono text-neutral-500 bg-neutral-800 border border-neutral-700 rounded">
                <Command className="w-3 h-3" />K
              </kbd>
            </button>
          </div>

          {/* Right Header: Active Peers & Persona Switcher */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Active Online Peers Avatar Cluster */}
            <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-neutral-800">
              <span className="text-2xs text-neutral-500 uppercase tracking-wider mr-1">{t.common.collaborators}</span>
              <div className="flex -space-x-2 overflow-hidden">
                {onlineUsers.map((peer) => (
                  <Avatar
                    key={peer.userId}
                    src={peer.avatar}
                    name={peer.name}
                    color={peer.color}
                    title={`${peer.name} (${peer.role})`}
                    className="inline-block h-7 w-7 rounded-full ring-2 ring-neutral-950 object-cover"
                  />
                ))}
              </div>
            </div>

            {/* Notification Center Popover */}
            <NotificationsPopover />

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-semibold text-neutral-200 block">{currentUser.name}</span>
                  <span className="text-3xs uppercase tracking-wider text-indigo-400 font-mono font-bold">
                    {currentUser.role}
                  </span>
                </div>
                <Avatar
                  src={currentUser.avatar}
                  name={currentUser.name}
                  color={currentUser.color}
                  className="w-8 h-8 rounded-lg object-cover border border-neutral-700"
                />
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </button>

              {/* Account Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2.5 border-b border-neutral-800 flex items-center gap-2.5">
                    <Avatar src={currentUser.avatar} name={currentUser.name} color={currentUser.color} className="w-8 h-8 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-200">{currentUser.name}</span>
                      <span className="block truncate text-3xs text-neutral-500">{currentUser.email}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 mt-1 rounded-lg text-left text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {t.common.settings}
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs font-medium text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t.common.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic View Component */}
        <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
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

      {/* Settings Modal: account, language & appearance */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
