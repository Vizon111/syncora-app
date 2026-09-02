'use client';

import { useEffect } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useToast } from '@/hooks/use-toast';

interface UseGlobalShortcutsOptions {
  onOpenQuickTask: () => void;
  onOpenSearch: () => void;
  onOpenShortcutsHelp: () => void;
  isModalOpen?: boolean;
}

export function useGlobalShortcuts({
  onOpenQuickTask,
  onOpenSearch,
  onOpenShortcutsHelp,
  isModalOpen,
}: UseGlobalShortcutsOptions) {
  const { setActiveView, createDocument, setSelectedDocId, t } = useWorkspace();
  const { undoLatest, success } = useToast();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable;

      // Global shortcuts with modifiers (can run even inside inputs if specified)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // Undo with Cmd+Z or Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // If not in a text input where native undo is needed
        if (!isInput) {
          e.preventDefault();
          const undone = await undoLatest();
          if (undone) {
            success(t.toasts.undoSuccess);
          }
          return;
        }
      }

      // If user is currently typing in an input or a modal is open, ignore plain key shortcuts
      if (isInput || isModalOpen) {
        return;
      }

      // 'C' key -> Quick Task Creation
      if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
        e.preventDefault();
        onOpenQuickTask();
        return;
      }

      // 'D' key -> Quick Document Creation
      if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        e.preventDefault();
        setActiveView('documents');
        return;
      }

      // 'M' key -> Jump to My Work / Focus
      if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        e.preventDefault();
        setActiveView('my-work');
        return;
      }

      // '?' key or 'Shift+/' -> Open Shortcuts Help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onOpenShortcutsHelp();
        return;
      }

      // Number keys 1-9 for switching views
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(e.key)) {
        e.preventDefault();
        const views = ['overview', 'my-work', 'tasks', 'timeline', 'sprints', 'documents', 'projects', 'ai', 'files', 'team'];
        const targetView = views[parseInt(e.key, 10) - 1];
        if (targetView) {
          setActiveView(targetView);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onOpenQuickTask,
    onOpenSearch,
    onOpenShortcutsHelp,
    isModalOpen,
    setActiveView,
    createDocument,
    setSelectedDocId,
    undoLatest,
    success,
    t.toasts.undoSuccess,
  ]);
}
