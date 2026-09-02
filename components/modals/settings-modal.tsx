'use client';

import React from 'react';
import { Settings, X, User as UserIcon, Globe, Moon, Sun, Sparkles, LogOut } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import type { Language } from '@/lib/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t, language, setLanguage, currentUser, currentWorkspace, signOut } = useWorkspace();

  if (!isOpen) return null;

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'ru', label: t.common.russian, flag: '🇷🇺' },
    { code: 'en', label: t.common.english, flag: '🇬🇧' },
    { code: 'es', label: t.common.spanish, flag: '🇪🇸' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">{t.settings.title}</h3>
              <p className="text-2xs text-neutral-400">{t.settings.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Account Section */}
          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-neutral-400">
              <UserIcon className="w-3 h-3" />
              {t.settings.accountSection}
            </h4>
            <div className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar
                  src={currentUser.avatar}
                  name={currentUser.name}
                  color={currentUser.color}
                  className="w-10 h-10 rounded-lg object-cover border border-neutral-700"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-200">
                    {currentUser.name}
                  </span>
                  <span className="block truncate text-2xs text-neutral-500">{currentUser.email}</span>
                </div>
                <span className="text-3xs uppercase tracking-wider text-indigo-400 font-mono font-bold px-2 py-1 rounded-md bg-indigo-950/60 border border-indigo-800/60 shrink-0">
                  {currentUser.role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                <div>
                  <span className="block text-3xs uppercase tracking-wider text-neutral-500 mb-0.5">
                    {t.settings.workspace}
                  </span>
                  <span className="text-xs text-neutral-300 font-medium truncate block">
                    {currentWorkspace.name}
                  </span>
                </div>
                <div>
                  <span className="block text-3xs uppercase tracking-wider text-neutral-500 mb-0.5">
                    {t.settings.role}
                  </span>
                  <span className="text-xs text-neutral-300 font-medium truncate block">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  signOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/40 hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.settings.signOut}
              </button>
            </div>
          </div>

          {/* Language Section */}
          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-neutral-400">
              <Globe className="w-3 h-3" />
              {t.settings.languageSection}
            </h4>
            <div className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 space-y-2">
              <p className="text-2xs text-neutral-500">{t.settings.languageHint}</p>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                      language === lang.code
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800/60'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-neutral-400">
              <Sparkles className="w-3 h-3" />
              {t.settings.appearanceSection}
            </h4>
            <div className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-300 font-medium">{t.settings.theme}</span>
                <span className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
                  {t.settings.themeComingSoon}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 opacity-50 cursor-not-allowed" title={t.settings.themeComingSoonHint}>
                <div className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white border border-indigo-500">
                  <Moon className="w-3.5 h-3.5" />
                  {t.settings.themeDark}
                </div>
                <div className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-semibold text-neutral-500 border border-neutral-800">
                  <Sun className="w-3.5 h-3.5" />
                  {t.settings.themeLight}
                </div>
              </div>
              <p className="text-2xs text-neutral-600 mt-2">{t.settings.themeComingSoonHint}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
