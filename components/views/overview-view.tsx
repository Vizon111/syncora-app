'use client';

import React from 'react';
import {
  Folder,
  CheckSquare,
  FileText,
  Users,
  Sparkles,
  ArrowUpRight,
  Clock,
  Activity,
  Layers,
  Shield,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';

export function OverviewView() {
  const {
    t,
    currentWorkspace,
    projects,
    tasks,
    documents,
    files,
    activities,
    onlineUsers,
    setActiveView,
    setSelectedDocId,
    setSelectedProjectId,
  } = useWorkspace();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-in fade-in duration-200">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/60 via-neutral-900 to-neutral-900 border border-indigo-900/40 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.ai.antiHallucination}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
              {currentWorkspace.name}
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl">
              {t.overview.subtitle}
            </p>
          </div>

          {/* Quick Stat Highlights */}
          <div className="flex items-center gap-4 bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80 backdrop-blur-xs">
            <div className="text-center px-3 border-r border-neutral-800">
              <span className="text-2xl font-bold text-neutral-100">{completionRate}%</span>
              <span className="block text-2xs text-neutral-500 uppercase tracking-wider mt-0.5">{t.overview.completedTasks}</span>
            </div>
            <div className="text-center px-3 border-r border-neutral-800">
              <span className="text-2xl font-bold text-indigo-400">{onlineUsers.length}</span>
              <span className="block text-2xs text-neutral-500 uppercase tracking-wider mt-0.5">{t.common.collaborators}</span>
            </div>
            <div className="text-center px-3">
              <span className="text-2xl font-bold text-emerald-400">{documents.length}</span>
              <span className="block text-2xs text-neutral-500 uppercase tracking-wider mt-0.5">{t.nav.documents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveView('projects')}
          className="group p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 cursor-pointer transition-all hover:bg-neutral-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t.projects.title}</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <Folder className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-100">{projects.length}</span>
            <span className="text-xs text-indigo-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              {t.common.actions} <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            {projects.filter((p) => p.status === 'in_progress').length} {t.projects.statusInProgress.toLowerCase()}
          </div>
        </div>

        <div
          onClick={() => setActiveView('tasks')}
          className="group p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 cursor-pointer transition-all hover:bg-neutral-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t.tasks.title}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-100">{totalTasks}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              {t.nav.tasks} <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            {inProgressTasks} {t.tasks.inProgress.toLowerCase()}, {tasks.filter((t) => t.priority === 'urgent').length} {t.tasks.priorityBlocker}
          </div>
        </div>

        <div
          onClick={() => setActiveView('documents')}
          className="group p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 cursor-pointer transition-all hover:bg-neutral-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t.documents.title}</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-100">{documents.length}</span>
            <span className="text-xs text-cyan-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              {t.documents.editMode} <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            CRDT Yjs • Realtime Sync
          </div>
        </div>

        <div
          onClick={() => setActiveView('files')}
          className="group p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 cursor-pointer transition-all hover:bg-neutral-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t.files.title}</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-100">{files.length + documents.length}</span>
            <span className="text-xs text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              RAG <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            100% {t.files.indexedBadge.toLowerCase()}
          </div>
        </div>
      </div>

      {/* Main Grid: Projects & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Projects & Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-100">{t.projects.title}</h3>
                <p className="text-xs text-neutral-400">{t.projects.subtitle}</p>
              </div>
              <button
                onClick={() => setActiveView('projects')}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {t.projects.openTasks}
              </button>
            </div>

            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setActiveView('projects');
                  }}
                  className="group p-4 rounded-lg bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-neutral-100 group-hover:text-indigo-400 transition-colors">
                          {p.name}
                        </h4>
                        <span
                          className={`text-2xs uppercase px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'in_progress'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : p.status === 'review'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {p.status === 'in_progress' ? t.projects.statusInProgress : p.status === 'review' ? t.projects.statusReview : p.status === 'completed' ? t.projects.statusCompleted : t.projects.statusPlanning}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-1">{p.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-neutral-200">{p.progress}%</span>
                      <div className="w-24 h-1.5 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500">{t.projects.lead}:</span>
                      <span className="text-neutral-300 font-medium">{p.lead?.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t.tasks.dueDate}: {new Date(p.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Access Documents */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-100">{t.documents.title}</h3>
                <p className="text-xs text-neutral-400">{t.documents.subtitle}</p>
              </div>
              <button
                onClick={() => setActiveView('documents')}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {t.documents.editMode}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setActiveView('documents');
                  }}
                  className="group p-3.5 rounded-lg bg-neutral-950/70 border border-neutral-800 hover:border-indigo-500/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{doc.emoji || '📄'}</span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-indigo-400 truncate transition-colors">
                        {doc.title}
                      </h4>
                      <p className="text-2xs text-neutral-500 mt-0.5">
                        v{doc.version} • {doc.lastEditedBy?.name || 'Team'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Realtime Activity Feed & Online Peers */}
        <div className="space-y-6">
          {/* Active Peers Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {t.common.collaborators} ({onlineUsers.length})
              </h3>
            </div>

            <div className="space-y-2.5">
              {onlineUsers.map((peer) => (
                <div key={peer.userId} className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar
                        src={peer.avatar}
                        name={peer.name}
                        color={peer.color}
                        className="w-7 h-7 rounded-full object-cover border"
                      />
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-neutral-200 block">{peer.name}</span>
                      <span className="text-2xs text-neutral-500 uppercase tracking-wider">{peer.role}</span>
                    </div>
                  </div>
                  <span className="text-2xs font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                    /{peer.currentLocation?.view || 'overview'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Stream */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                {t.overview.recentActivity}
              </h3>
            </div>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {activities.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-4">{t.overview.noActivities}</p>
              ) : (
                activities.slice(0, 8).map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs">
                    <Avatar
                      src={act.userAvatar}
                      name={act.userName}
                      className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-300">
                        <span className="font-semibold text-neutral-100">{act.userName}</span>{' '}
                        <span className="text-neutral-400">
                          {act.action === 'created_task' && t.overview.actCreatedTask}
                          {act.action === 'updated_task_status' && t.overview.actUpdatedTaskStatus}
                          {act.action === 'edited_document' && t.overview.actEditedDocument}
                          {act.action === 'added_comment' && t.overview.actAddedComment}
                          {act.action === 'uploaded_file' && t.overview.actUploadedFile}
                          {act.action === 'user_joined' && t.overview.actUserJoined}
                        </span>{' '}
                        <span className="text-neutral-200 font-medium truncate block">{act.targetName}</span>
                      </p>
                      {act.details && <p className="text-2xs text-neutral-500 mt-0.5">{act.details}</p>}
                      <span className="text-2xs text-neutral-600 block mt-1">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
