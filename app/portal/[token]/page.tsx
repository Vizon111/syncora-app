'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, Flag, FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import type { PortalData } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
};

const STATUS_ICON: Record<string, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  review: AlertCircle,
  done: CheckCircle2,
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  review: 'In review',
  completed: 'Completed',
  on_hold: 'On hold',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownload = async (fileId: string, fileName: string) => {
    if (!token) return;
    setDownloadingId(fileId);
    try {
      const res = await fetch(
        `/api/portal/${encodeURIComponent(token)}/download?fileId=${encodeURIComponent(fileId)}`
      );
      const json = await res.json();
      if (!res.ok || !json.downloadUrl) throw new Error();
      const link = document.createElement('a');
      link.href = json.downloadUrl;
      link.download = json.name || fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Silent — this is a public page with no toast system; a failed
      // download here is rare (signed URL creation failing) and the user
      // can just click again.
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h1 className="text-base font-semibold text-slate-700 mb-1">Link not available</h1>
          <p className="text-sm text-slate-500">
            This link may have been disabled, or the address is incorrect. Please check with the person who shared it.
          </p>
        </div>
      </div>
    );
  }

  const doneCount = data.tasks.filter((t) => t.status === 'done').length;
  const milestones = data.tasks.filter((t) => t.milestone);
  const regularTasks = data.tasks.filter((t) => !t.milestone);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="inline-block text-2xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
            {data.workspaceName}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{data.projectName}</h1>
          {data.projectDescription && (
            <p className="text-sm text-slate-500 max-w-lg mx-auto">{data.projectDescription}</p>
          )}
        </div>

        {/* Progress card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Progress</span>
            <span className="text-sm font-bold text-indigo-600">{data.progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, data.progress))}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>{PROJECT_STATUS_LABEL[data.status] || data.status}</span>
            <span>
              {doneCount} / {data.tasks.length} tasks done
            </span>
          </div>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
              <Flag className="w-3 h-3" />
              Milestones
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
              {milestones.map((task) => {
                const Icon = STATUS_ICON[task.status] || Circle;
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                    />
                    <span className="text-sm text-slate-700 flex-1">{task.title}</span>
                    <span className="text-2xs font-medium text-slate-400">{STATUS_LABEL[task.status]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks */}
        {regularTasks.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-2xs font-bold uppercase tracking-wider text-slate-400">Tasks</h2>
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
              {regularTasks.map((task) => {
                const Icon = STATUS_ICON[task.status] || Circle;
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                    />
                    <span className="text-sm text-slate-700 flex-1">{task.title}</span>
                    <span className="text-2xs font-medium text-slate-400">{STATUS_LABEL[task.status]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.tasks.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-4">No tasks to show yet.</p>
        )}

        {/* Files */}
        {data.files.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
              <FileText className="w-3 h-3" />
              Files
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
              {data.files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleDownload(file.id, file.name)}
                  disabled={downloadingId === file.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{file.name}</span>
                  <span className="text-2xs text-slate-400 shrink-0">{formatBytes(file.size)}</span>
                  {downloadingId === file.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-2xs text-slate-300 pt-4">Powered by Syncora</p>
      </div>
    </div>
  );
}
