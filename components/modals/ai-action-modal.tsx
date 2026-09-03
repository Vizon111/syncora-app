'use client';

import React, { useState } from 'react';
import { Sparkles, Check, X, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { AiActionProposal } from '@/lib/types';
import { useWorkspace } from '@/hooks/use-workspace-context';

interface AiActionModalProps {
  proposal: AiActionProposal | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AiActionModal({ proposal, onClose, onSuccess }: AiActionModalProps) {
  const { t, currentWorkspace, currentUser, refreshData } = useWorkspace();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!proposal) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          proposal,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(data.message || t.ai.actionExecuted);
        await refreshData();
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1200);
      } else {
        setFeedback(`Error: ${data.error || t.ai.executionFailed}`);
      }
    } catch {
      setFeedback(t.ai.networkError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-100">{proposal.title}</h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{t.ai.modalTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              {t.ai.modalSubtitle}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">{t.ai.actionProposal}</span>
            <p className="text-sm text-slate-700 dark:text-neutral-200 mt-1">{proposal.description}</p>
          </div>

          {/* Structured Payload Preview */}
          <div className="bg-slate-50 dark:bg-neutral-950 p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800">
            <span className="text-xs font-mono text-slate-500 dark:text-neutral-400 block mb-2">{t.ai.payloadPreview}</span>
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-neutral-300 font-mono">
              <div className="flex">
                <span className="text-slate-500 dark:text-neutral-500 w-24 shrink-0">{t.common.actions}:</span>
                <span className="text-indigo-400">{proposal.type}</span>
              </div>
              <div className="flex">
                <span className="text-slate-500 dark:text-neutral-500 w-24 shrink-0">{t.tasks.taskTitle}:</span>
                <span className="text-slate-700 dark:text-neutral-200">{proposal.payload?.title}</span>
              </div>
              {proposal.payload?.status && (
                <div className="flex">
                  <span className="text-slate-500 dark:text-neutral-500 w-24 shrink-0">{t.common.status}:</span>
                  <span className="text-emerald-400">{proposal.payload.status.toUpperCase()}</span>
                </div>
              )}
              {proposal.payload?.priority && (
                <div className="flex">
                  <span className="text-slate-500 dark:text-neutral-500 w-24 shrink-0">{t.tasks.priorityLabel}:</span>
                  <span className="text-amber-400">{proposal.payload.priority.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                feedback.startsWith('Error')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>{t.ai.applying}</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{t.ai.approveAction}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
