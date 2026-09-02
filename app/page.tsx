'use client';

import React from 'react';
import { WorkspaceProvider } from '@/hooks/use-workspace-context';
import { ToastProvider } from '@/hooks/use-toast';
import { AppShell } from '@/components/layout/app-shell';

export default function HomePage() {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

