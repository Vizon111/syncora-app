'use client';

import React from 'react';
import { Settings, User as UserIcon, Globe, Moon, Sun, Sparkles, LogOut } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/components/ui/avatar';
import type { Language } from '@/lib/i18n';

export function SettingsView() {
  const { t, language, setLanguage, currentUser, currentWorkspace, signOut } = useWorkspace();
  const { theme, setTheme } = useTheme();

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'ru', label: t.common.russian, flag: '🇷🇺' },
    { code: 'en', label: t.common.english, flag: '🇬🇧' },
    { code: 'es', label: t.common.spanish, flag: '🇪🇸' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-600/20 dark:border-indigo-500/30 dark:text-indigo-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100">{t.settings.title}</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400">{t.settings.subtitle}</p>
        </div>
      </div>

      {/* Account Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <UserIcon className="w-3 h-3" />
          {t.settings.accountSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              color={currentUser.color}
              className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-neutral-700"
            />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-neutral-200">
                {currentUser.name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-neutral-500">{currentUser.email}</span>
            </div>
            <span className="text-3xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono font-bold px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800/60 shrink-0">
              {currentUser.role}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-neutral-800">
            <div>
              <span className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-0.5">
                {t.settings.workspace}
              </span>
              <span className="text-sm text-slate-600 dark:text-neutral-300 font-medium truncate block">
                {currentWorkspace.name}
              </span>
            </div>
            <div>
              <span className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-0.5">
                {t.settings.role}
              </span>
              <span className="text-sm text-slate-600 dark:text-neutral-300 font-medium truncate block">
                {currentUser.role}
              </span>
            </div>
          </div>

          <button
            onClick={signOut}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900/40 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.settings.signOut}
          </button>
        </div>
      </div>

      {/* Language Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <Globe className="w-3 h-3" />
          {t.settings.languageSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
          <p className="text-xs text-slate-500 dark:text-neutral-500">{t.settings.languageHint}</p>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-xs font-semibold transition-all border ${
                  language === lang.code
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100 dark:text-neutral-400 dark:border-neutral-800 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/60'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <Sparkles className="w-3 h-3" />
          {t.settings.appearanceSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-sm text-slate-600 dark:text-neutral-300 font-medium block mb-3">{t.settings.theme}</span>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-xs font-semibold border transition-all ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100 dark:text-neutral-500 dark:border-neutral-800 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/60'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              {t.settings.themeDark}
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-xs font-semibold border transition-all ${
                theme === 'light'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100 dark:text-neutral-500 dark:border-neutral-800 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/60'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              {t.settings.themeLight}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
