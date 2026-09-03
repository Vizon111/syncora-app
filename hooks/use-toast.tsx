'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, RotateCcw, X } from 'lucide-react';
import { TRANSLATIONS, Language } from '@/lib/i18n';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  undoAction?: () => Promise<void> | void;
  undoLabel?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
  isUndone?: boolean;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (options: Omit<ToastItem, 'id' | 'createdAt'>) => string;
  success: (title: string, description?: string, undoAction?: () => Promise<void> | void) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismissToast: (id: string) => void;
  undoLatest: () => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((options: Omit<ToastItem, 'id' | 'createdAt'>) => {
    const id = `toast_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const newToast: ToastItem = {
      ...options,
      id,
      type: options.type || 'info',
      duration: options.duration ?? 4500,
      createdAt: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, newToast.duration);
    }

    return id;
  }, [dismissToast]);

  const success = useCallback(
    (title: string, description?: string, undoAction?: () => Promise<void> | void) => {
      return showToast({ title, description, type: 'success', undoAction });
    },
    [showToast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, type: 'error', duration: 5500 });
    },
    [showToast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, type: 'info' });
    },
    [showToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, type: 'warning' });
    },
    [showToast]
  );

  const undoLatest = useCallback(async () => {
    const activeWithUndo = toastsRef.current.find((t) => t.undoAction && !t.isUndone);
    if (!activeWithUndo || !activeWithUndo.undoAction) return false;

    // Mark as undone
    setToasts((prev) =>
      prev.map((item) => (item.id === activeWithUndo.id ? { ...item, isUndone: true } : item))
    );

    try {
      await activeWithUndo.undoAction();
      dismissToast(activeWithUndo.id);
      return true;
    } catch {
      return false;
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        success,
        error,
        info,
        warning,
        dismissToast,
        undoLatest,
      }}
    >
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [progress, setProgress] = useState(100);

  // Animate timer bar
  useEffect(() => {
    const duration = toast.duration || 4500;
    const interval = 20;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.duration]);

  const handleUndo = async () => {
    if (!toast.undoAction || isUndoing) return;
    setIsUndoing(true);
    try {
      await toast.undoAction();
      onDismiss();
    } catch {
      setIsUndoing(false);
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/30';
      case 'error':
        return 'border-rose-500/30';
      case 'warning':
        return 'border-amber-500/30';
      case 'info':
      default:
        return 'border-indigo-500/30';
    }
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-3.5 rounded-xl bg-white/95 dark:bg-neutral-900/95 border ${getBorderColor()} shadow-2xl shadow-black/80 backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-4`}
    >
      <div className="pt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 dark:text-neutral-100">{toast.title}</p>
          <button
            onClick={onDismiss}
            className="text-slate-500 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {toast.description && (
          <p className="text-2xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-relaxed break-words">
            {toast.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          {toast.undoAction && !toast.isUndone && (
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-md bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 hover:text-white transition-all shadow-xs"
            >
              <RotateCcw className={`w-3 h-3 ${isUndoing ? 'animate-spin' : ''}`} />
              <span>{toast.undoLabel || 'Отменить [Cmd+Z]'}</span>
            </button>
          )}

          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="px-2.5 py-1 text-2xs font-semibold rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>

      {/* Countdown progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-indigo-500/40 transition-all ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
