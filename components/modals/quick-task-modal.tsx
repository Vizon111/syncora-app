'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, X, CornerDownLeft, Sparkles, Flag, Folder, UserCheck, Zap, Clock } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';
import { TaskPriority } from '@/lib/types';
import { AiTaskBreakdown } from '@/components/tasks/ai-task-breakdown';

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickTaskModal({ isOpen, onClose }: QuickTaskModalProps) {
  if (!isOpen) return null;

  return <QuickTaskModalContent onClose={onClose} />;
}

function QuickTaskModalContent({ onClose }: { onClose: () => void }) {
  const { t, projects, allUsers, currentUser, sprints, activeSprint, createTask, deleteTask } = useWorkspace();
  const { success, error } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || 'prj_mobile_app');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [estimatedHours, setEstimatedHours] = useState<number>(4);
  const [sprintId, setSprintId] = useState<string>(activeSprint?.id || '');
  const [labels, setLabels] = useState<string[]>(['HotKey', 'FastEntry']);
  const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<{ id: string; text: string; satisfied: boolean }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTask({
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || projects[0]?.id || 'prj_mobile_app',
        priority,
        assigneeId: assigneeId || currentUser.id,
        status: 'todo',
        storyPoints: storyPoints || 3,
        estimatedHours: estimatedHours || 4,
        loggedHours: 0,
        sprintId: sprintId || undefined,
        labels,
        subtasks,
        acceptanceCriteria,
      });

      if (created) {
        // Show success toast with Undo action!
        success(
          `${t.toasts.taskCreated}: «${created.title}»`,
          `${projects.find((p) => p.id === created.projectId)?.name || 'Project'} • ${priority.toUpperCase()}`,
          async () => {
            await deleteTask(created.id);
          }
        );
        onClose();
      }
    } catch {
      error('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorities: { id: TaskPriority; label: string; color: string }[] = [
    { id: 'urgent', label: 'P0 Urgent', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
    { id: 'high', label: 'P1 High', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
    { id: 'medium', label: 'P2 Medium', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
    { id: 'low', label: 'P3 Low', color: 'text-neutral-400 border-neutral-700 bg-neutral-800' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                {t.quickTask.title}
                <span className="text-2xs font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/60">
                  [C]
                </span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.tasks.titlePlaceholder}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium"
            />
          </div>

          <div>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.tasks.descPlaceholder}
              className="w-full px-3 py-2 text-xs bg-neutral-950/70 border border-neutral-800/80 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-neutral-700 transition-all resize-none"
            />
          </div>

          {/* Quick selectors: Priority & Project */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xs text-neutral-500 uppercase tracking-wider font-semibold w-16 shrink-0">
                {t.tasks.priorityLabel}:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {priorities.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all ${
                      priority === p.id
                        ? `${p.color} ring-1 ring-white/20 shadow-xs scale-102`
                        : 'text-neutral-400 border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs text-neutral-500 uppercase tracking-wider font-semibold mb-1">
                  {t.tasks.projectLabel}
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-neutral-700"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs text-neutral-500 uppercase tracking-wider font-semibold mb-1">
                  {t.tasks.assigneeLabel}
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-neutral-700"
                >
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sprint & Story Points & Est Hours */}
            <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/60">
              <div>
                <label className="block text-3xs text-neutral-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  {t.tasks.sprint}
                </label>
                <select
                  value={sprintId}
                  onChange={(e) => setSprintId(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden"
                >
                  <option value="">{t.tasks.backlog}</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === 'active' ? '🔥' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-3xs text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                  ⚡ {t.tasks.storyPoints}
                </label>
                <select
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 font-mono font-bold focus:outline-hidden"
                >
                  {[1, 2, 3, 5, 8, 13, 21].map((pts) => (
                    <option key={pts} value={pts}>
                      {pts} SP
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-3xs text-neutral-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  {t.tasks.estimatedHours}
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Math.max(1, Number(e.target.value)))}
                  className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 font-mono focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* AI Subtasks & Criteria Generator */}
          <AiTaskBreakdown
            title={title}
            description={description}
            projectId={projectId}
            subtasks={subtasks}
            acceptanceCriteria={acceptanceCriteria}
            onSubtasksChange={setSubtasks}
            onAcceptanceCriteriaChange={setAcceptanceCriteria}
            onApplyPriority={setPriority}
            onApplyStoryPoints={setStoryPoints}
            onApplyEstimatedHours={setEstimatedHours}
            onApplyLabels={(newLabels) => {
              setLabels(Array.from(new Set([...labels, ...newLabels])));
            }}
          />

          {/* Footer Controls */}
          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-2xs text-neutral-500">
              <span>{t.quickTask.hotkeyTip}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg"
              >
                {t.quickTask.cancel}
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <span>{t.quickTask.submitButton}</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
