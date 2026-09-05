'use client';

import React, { useState, useRef } from 'react';
import {
  Paperclip,
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  Eye,
  X,
  File,
  Download,
  Loader2,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';
import { FileItem } from '@/lib/types';
import { STORAGE_BUCKET } from '@/lib/storage/constants';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — generous for docs/specs, keeps storage costs sane

export function FilesView() {
  const { t, files, uploadFile, deleteFile, currentWorkspace, currentUser } = useWorkspace();
  const { success, error } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Uploads the real file bytes to Supabase Storage, then records the
   *  metadata (including the storage path) in the files table. Text-based
   *  files also get their content extracted client-side for RAG indexing —
   *  binary files (PDFs, images) skip that and just get an empty
   *  extractedText, which is fine: they're still downloadable, just not
   *  searchable by the AI assistant yet. */
  const handleRealUpload = async (file: globalThis.File) => {
    if (currentUser.role === 'viewer') {
      error(t.toasts.permDenied);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      error(t.files.fileTooLarge || 'File is too large (max 25MB)');
      return;
    }

    setIsUploading(true);
    try {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseBrowserClient();

      const storagePath = `${currentWorkspace!.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) throw uploadError;

      // Best-effort text extraction for RAG indexing — only for text-like
      // files; binary formats (pdf/png/etc) are skipped rather than reading
      // garbage bytes as "text".
      let extractedText = '';
      const isTextLike = file.type.startsWith('text/') || /\.(md|txt|json|csv)$/i.test(file.name);
      if (isTextLike) {
        try {
          extractedText = await file.text();
        } catch {
          // non-fatal — file still uploads and downloads fine without it
        }
      }

      const uploaded = await uploadFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: storagePath,
        extractedText,
        isIndexedForRag: isTextLike && extractedText.length > 0,
        projectId: 'prj_flowspace_core',
      });

      if (uploaded) {
        success(`${t.toasts.fileUploaded}: «${uploaded.name}»`);
      } else {
        // Metadata insert failed after the blob already landed in Storage —
        // clean up the orphaned object so it doesn't linger unreferenced.
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        error(t.toasts.uploadFailed);
      }
    } catch {
      error(t.toasts.uploadFailed);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (!file.url) {
      error(t.files.noStoredContent || 'This file has no downloadable content');
      return;
    }
    setDownloadingId(file.id);
    try {
      const res = await fetch(
        `/api/files/download-url?fileId=${encodeURIComponent(file.id)}&workspaceId=${encodeURIComponent(currentWorkspace!.id)}`
      );
      const data = await res.json();
      if (!res.ok || !data.downloadUrl) throw new Error(data.error || 'Failed to get download link');

      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.name || file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      error(t.toasts.downloadFailed);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleRealUpload(droppedFiles[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleRealUpload(picked);
    e.target.value = ''; // allow re-selecting the same file later
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-100">{t.files.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t.files.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>{t.files.uploadButton}</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-indigo-500 bg-indigo-950/20 scale-[0.99]'
            : 'border-slate-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 hover:border-slate-300 dark:hover:border-neutral-700'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{t.files.dragDropTitle}</h4>
          <p className="text-xs text-slate-500 dark:text-neutral-500 max-w-sm">
            {t.files.dragDropDesc}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 dark:text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.files.searchFiles}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-700 dark:text-neutral-200 placeholder-neutral-500 focus:outline-hidden"
          />
        </div>
        <span className="text-2xs text-slate-500 dark:text-neutral-500 font-mono">
          {filteredFiles.length} {t.files.filesInStorage}
        </span>
      </div>

      {/* Files Table */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-neutral-950/80 border-b border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-5 py-3">{t.files.colFileName}</th>
                <th className="px-4 py-3">{t.files.colType}</th>
                <th className="px-4 py-3">{t.files.colSize}</th>
                <th className="px-4 py-3">{t.files.colRagStatus}</th>
                <th className="px-4 py-3">{t.files.colUploadedBy}</th>
                <th className="px-4 py-3 text-right">{t.files.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-neutral-800/60 text-slate-600 dark:text-neutral-300">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-100/50 dark:hover:bg-neutral-850/50 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-2.5 font-medium text-slate-800 dark:text-neutral-100">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate max-w-xs">{file.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-neutral-400 font-mono text-2xs">{file.type}</td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-neutral-400 font-mono">
                    {Math.round(file.size / 1024)} KB
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-2xs font-semibold">
                      <Sparkles className="w-3 h-3" />
                      {t.files.indexedBadge}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-neutral-400">{file.uploadedBy?.name || t.tasks.teamDefault}</td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={!file.url || downloadingId === file.id}
                      className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                      title={file.url ? (t.files.downloadFile || 'Download') : (t.files.noStoredContent || 'No stored content')}
                    >
                      {downloadingId === file.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedFile(file)}
                      className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title={t.files.previewText}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (currentUser.role === 'viewer') {
                          error(t.toasts.permDenied);
                          return;
                        }
                        const fileToDelete = { ...file };
                        const deleted = await deleteFile(fileToDelete.id);
                        if (deleted) {
                          success(
                            `${t.toasts.fileDeleted}: «${fileToDelete.name}»`,
                            undefined,
                            async () => {
                              // Note: this re-inserts metadata pointing at the
                              // same storage_path. We deliberately don't
                              // delete the underlying Storage object on
                              // delete (see comment below), so the restored
                              // row still resolves to real, downloadable
                              // content.
                              await uploadFile({
                                id: fileToDelete.id,
                                name: fileToDelete.name,
                                size: fileToDelete.size,
                                type: fileToDelete.type,
                                url: fileToDelete.url,
                                extractedText: fileToDelete.extractedText,
                                isIndexedForRag: fileToDelete.isIndexedForRag,
                                projectId: fileToDelete.projectId,
                              });
                            }
                          );
                        }
                      }}
                      className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{selectedFile.name}</h3>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <span className="text-2xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                {t.files.previewTitle}
              </span>
              <pre className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {selectedFile.extractedText || t.files.noTextExtracted}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
