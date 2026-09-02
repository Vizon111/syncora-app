import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Flowspace — Real-time Workspace & AI Knowledge Layer',
  description: 'Enterprise-grade collaborative workspace for modern squads. Real-time Yjs CRDT document editing, Kanban boards, and Gemini 3.7 Flash RAG intelligence.',
  openGraph: {
    title: 'Flowspace — Real-time Workspace & AI Knowledge Layer',
    description: 'Enterprise-grade collaborative workspace with CRDT and AI RAG knowledge engine.',
    type: 'website',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
