'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  Loader2,
  Power,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Receipt,
  Download,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';
import type { Project, ProjectPortalLink } from '@/lib/types';

interface SharePortalModalProps {
  project: Project;
  onClose: () => void;
}

type Tab = 'link' | 'digest' | 'invoice';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'digest', label: 'Digest', icon: Sparkles },
  { id: 'invoice', label: 'Invoice', icon: Receipt },
];

export function SharePortalModal({ project, onClose }: SharePortalModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('link');

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
          <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Client updates</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-neutral-800 px-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'link' && <LinkTab project={project} />}
          {activeTab === 'digest' && <DigestTab project={project} />}
          {activeTab === 'invoice' && <InvoiceTab project={project} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Link tab
// ---------------------------------------------------------------------------

function LinkTab({ project }: { project: Project }) {
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
    <div className="space-y-4">
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
  );
}

// ---------------------------------------------------------------------------
// Digest tab
// ---------------------------------------------------------------------------

function DigestTab({ project }: { project: Project }) {
  const { currentWorkspace } = useWorkspace();
  const { error } = useToast();
  const [digest, setDigest] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setDigest('');
    try {
      const res = await fetch('/api/projects/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, workspaceId: currentWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.digest) throw new Error();
      setDigest(data.digest);
    } catch {
      error('Failed to generate digest');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed flex-1 pr-3">
          AI summarizes the last 7 days of progress into a short update you can paste into an email or message.
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-600/15 dark:border-indigo-500/30 dark:hover:bg-indigo-600/25 disabled:opacity-50 transition-colors"
        >
          {isGenerating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : digest ? (
            <RefreshCw className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {digest ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {digest && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg p-3 whitespace-pre-wrap">
            {digest}
          </p>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-100 dark:text-neutral-300 dark:border-neutral-800 dark:hover:bg-neutral-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy text'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice tab
// ---------------------------------------------------------------------------

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function InvoiceTab({ project }: { project: Project }) {
  const { currentWorkspace, updateProjectHourlyRate } = useWorkspace();
  const { error } = useToast();

  const [rateInput, setRateInput] = useState(project.hourlyRate ? String(project.hourlyRate) : '');
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [clientName, setClientName] = useState('');
  const [periodStart, setPeriodStart] = useState(daysAgoIso(30));
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [isGenerating, setIsGenerating] = useState(false);

  const hasRate = Boolean(project.hourlyRate && project.hourlyRate > 0);

  const handleSaveRate = async () => {
    const parsed = parseFloat(rateInput);
    if (isNaN(parsed) || parsed <= 0) {
      error('Enter a valid hourly rate');
      return;
    }
    setIsSavingRate(true);
    const ok = await updateProjectHourlyRate(project.id, parsed);
    setIsSavingRate(false);
    if (!ok) {
      error('Failed to save rate');
    } else {
      setIsEditingRate(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/projects/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          workspaceId: currentWorkspace.id,
          periodStart,
          periodEnd,
          clientName: clientName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate invoice');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!hasRate) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
          Set an hourly rate for this project to generate invoices from logged worklog hours.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="75.00"
              className="w-full pl-6 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </div>
          <span className="text-xs text-slate-400 dark:text-neutral-500 shrink-0">/ hr</span>
          <button
            onClick={handleSaveRate}
            disabled={isSavingRate || !rateInput}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isSavingRate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
        <span>
          Rate: <strong className="text-slate-700 dark:text-neutral-200">${project.hourlyRate?.toFixed(2)}/hr</strong>
        </span>
        {!isEditingRate && (
          <button
            onClick={() => setIsEditingRate(true)}
            className="text-2xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Change rate
          </button>
        )}
      </div>

      {isEditingRate && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-full pl-6 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </div>
          <button
            onClick={handleSaveRate}
            disabled={isSavingRate}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isSavingRate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      )}

      <div className="pt-1 space-y-2.5">
        <div>
          <label className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
            Client name (optional)
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:placeholder-neutral-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </div>
          <div>
            <label className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateInvoice}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Generate PDF invoice
        </button>
      </div>
    </div>
  );
}
