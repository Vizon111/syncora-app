'use client';

import React, { useState } from 'react';
import { User as UserIcon, Camera, Mail, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function ProfileView() {
  const { t, currentUser, updateProfile, signOut } = useWorkspace();
  const { showToast } = useToast();

  const [name, setName] = useState(currentUser.name);
  const [isSavingName, setIsSavingName] = useState(false);

  const [photoUrl, setPhotoUrl] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentUser.name) return;
    setIsSavingName(true);
    const result = await updateProfile({ name: trimmed });
    setIsSavingName(false);
    if (result) {
      showToast({ type: 'success', title: t.profile.nameUpdated });
    } else {
      showToast({ type: 'error', title: t.profile.updateFailed });
    }
  };

  const handleSavePhoto = async () => {
    const trimmed = photoUrl.trim();
    if (!trimmed) return;
    setIsSavingPhoto(true);
    const result = await updateProfile({ avatarUrl: trimmed });
    setIsSavingPhoto(false);
    if (result) {
      showToast({ type: 'success', title: t.profile.photoUpdated });
      setPhotoUrl('');
    } else {
      showToast({ type: 'error', title: t.profile.updateFailed });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      showToast({ type: 'error', title: t.profile.passwordTooShort });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: 'error', title: t.profile.passwordMismatch });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showToast({ type: 'success', title: t.profile.passwordUpdated });
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showToast({ type: 'error', title: t.profile.updateFailed });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-600/20 dark:border-indigo-500/30 dark:text-indigo-400">
          <UserIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100">{t.profile.title}</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400">{t.profile.subtitle}</p>
        </div>
      </div>

      {/* Profile Photo Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <Camera className="w-3 h-3" />
          {t.profile.photoSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
          <div className="flex items-center gap-4">
            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              color={currentUser.color}
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-neutral-700 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-slate-500 dark:text-neutral-500">{t.profile.photoHint}</p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder={t.profile.photoUrlPlaceholder}
                  className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:placeholder-neutral-600"
                />
                <button
                  onClick={handleSavePhoto}
                  disabled={!photoUrl.trim() || isSavingPhoto}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.profile.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Name Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <UserIcon className="w-3 h-3" />
          {t.profile.nameSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            />
            <button
              onClick={handleSaveName}
              disabled={!name.trim() || name.trim() === currentUser.name || isSavingName}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
            >
              {isSavingName && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t.profile.save}
            </button>
          </div>
        </div>
      </div>

      {/* Email Section (read-only) */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <Mail className="w-3 h-3" />
          {t.profile.emailSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 space-y-1.5">
          <p className="text-sm text-slate-700 dark:text-neutral-300 font-mono">{currentUser.email}</p>
          <p className="text-2xs text-slate-400 dark:text-neutral-600">{t.profile.emailHint}</p>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
          <KeyRound className="w-3 h-3" />
          {t.profile.passwordSection}
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
          <div>
            <label className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
              {t.profile.newPassword}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t.profile.newPasswordPlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:placeholder-neutral-600"
            />
          </div>
          <div>
            <label className="block text-3xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
              {t.profile.confirmPassword}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t.profile.confirmPasswordPlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:placeholder-neutral-600"
            />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={!newPassword || !confirmPassword || isUpdatingPassword}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
          >
            {isUpdatingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t.profile.updatePassword}
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="pt-2">
        <button
          onClick={signOut}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900/40 dark:hover:bg-red-950/40 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t.settings.signOut}
        </button>
      </div>
    </div>
  );
}
