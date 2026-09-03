'use client';

import React, { useState } from 'react';
import {
  Folder,
  Plus,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  X,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { Project } from '@/lib/types';

export function ProjectsView() {
  const { t, projects, currentWorkspace, currentUser, setActiveView, setSelectedProjectId } = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('$25,000');
  const [tags, setTags] = useState('Frontend, Realtime');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          name: name.trim(),
          description: description.trim(),
          budget,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      setIsCreateOpen(false);
      setName('');
      setDescription('');
    } catch {}
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-100">{t.projects.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t.projects.subtitle}
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t.projects.newProject}</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 flex flex-col justify-between space-y-4 shadow-lg transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={`text-2xs font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                    proj.status === 'in_progress'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : proj.status === 'review'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : proj.status === 'planning'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {proj.status === 'planning' && t.projects.statusPlanning}
                  {proj.status === 'in_progress' && t.projects.statusInProgress}
                  {proj.status === 'review' && t.projects.statusReview}
                  {proj.status === 'completed' && t.projects.statusCompleted}
                  {proj.status === 'on_hold' && t.projects.statusOnHold}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-neutral-300">{proj.budget}</span>
              </div>

              <h3 className="text-base font-bold text-slate-800 dark:text-neutral-100">{proj.name}</h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">{proj.description}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {proj.tags.map((tItem) => (
                <span
                  key={tItem}
                  className="text-2xs font-medium px-2 py-0.5 rounded bg-slate-100/80 dark:bg-neutral-800/80 text-slate-500 dark:text-neutral-400 border border-slate-300/50 dark:border-neutral-700/50"
                >
                  {tItem}
                </span>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs">
                <span className="text-slate-500 dark:text-neutral-400">{t.projects.progress}</span>
                <span className="font-semibold text-slate-700 dark:text-neutral-200">{proj.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-50 dark:bg-neutral-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${proj.progress}%` }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={proj.lead?.avatar}
                  name={proj.lead?.name || ''}
                  color={proj.lead?.color}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-slate-600 dark:text-neutral-300 font-medium">{proj.lead?.name}</span>
              </div>

              <button
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setActiveView('tasks');
                }}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs"
              >
                <span>{t.nav.tasks}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-100">{t.projects.createTitle}</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.projects.nameLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.projects.namePlaceholder}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.projects.descriptionLabel}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.projects.descPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.projects.budgetLabel}
                  </label>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    {t.projects.tagsLabel}
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20"
                >
                  {t.projects.createTitle}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
