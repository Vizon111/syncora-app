import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-neutral-950 text-slate-800 dark:text-neutral-100 p-6 text-center">
      <h2 className="text-2xl font-bold mb-2">404 — Page Not Found</h2>
      <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6">The requested resource could not be located.</p>
      <Link
        href="/"
        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
      >
        Return to Workspace
      </Link>
    </div>
  );
}
