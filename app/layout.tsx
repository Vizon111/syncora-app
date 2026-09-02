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
    <html lang="en" className="dark">
      <head>
        <script
          // Runs before paint to avoid a flash of the wrong theme.
          // Reads the persisted preference and applies the class to <html>
          // ahead of React hydration.
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem('flowspace-theme');
                  var isLight = stored === 'light';
                  document.documentElement.classList.toggle('dark', !isLight);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
