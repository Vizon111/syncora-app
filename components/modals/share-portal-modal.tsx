'use client';

import React, { useEffect, useState } from 'react';
import { X, Link2, Copy, Check, Loader2, Power, ExternalLink } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';
import type { Project, ProjectPortalLink } from '@/lib/types';

interface SharePortalModalProps {
  project: Project;
  onClose: () => void;
}

export function SharePortalModal({ project, onClose }: SharePortalModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { success, error } = useToast();
  const [link, setLink] = useState<ProjectPortalLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/portal-link?projectId=${encodeURIComponent(project.id)}&workspaceId=${encodeURIComponent(currentWorkspace.id)}`
        );
        const data = await res.json();
        if (!cancelled) setLink(data.link || null);
      } catch {
        // leave link null — the "Generate link" button covers this case
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, currentWorkspace.id]);

  const portalUrl = link ? `${window.location.origin}/portal/${link.token}` : '';

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/projects/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, workspaceId: currentWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error();
      setLink(data.link);
    } catch {
      error('Failed to generate link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggle = async () => {
    if (!link) return;
    setIsToggling(true);
    try {
      const res = await fetch('/api/projects/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          workspaceId: currentWorkspace.id,
          isEnabled: !link.isEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error();
      setLink(data.link);
      success(data.link.isEnabled ? 'Link re-enabled' : 'Link disabled');
    } catch {
      error('Failed to update link');
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopy = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Share with client</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
            Anyone with this link can view <strong className="text-slate-700 dark:text-neutral-200">{project.name}</strong>
            &apos;s progress, task list, and files — no account needed. Internal details (descriptions, comments,
            assignees) are never shown.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : !link ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Generate link
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={portalUrl}
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                />
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-neutral-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${link.isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {link.isEnabled ? 'Link is active' : 'Link is disabled'}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-2xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Preview <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleToggle}
                    disabled={isToggling}
                    className="flex items-center gap-1 text-2xs font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 disabled:opacity-50"
                  >
                    {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                    {link.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
