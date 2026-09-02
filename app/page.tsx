'use client';

import React from 'react';
import { WorkspaceProvider } from '@/hooks/use-workspace-context';
import { ToastProvider } from '@/hooks/use-toast';
import { ThemeProvider } from '@/hooks/use-theme';
import { AppShell } from '@/components/layout/app-shell';

export default function HomePage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

