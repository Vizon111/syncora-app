'use client';

import React, { useState } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  Lock,
  Check,
  AlertTriangle,
  Mail,
  MoreVertical,
  X,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import { Avatar } from '@/components/ui/avatar';
import { Role } from '@/lib/types';

export function TeamRolesView() {
  const { t, allUsers, currentUser, currentWorkspace, refreshData } = useWorkspace();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const ROLE_PERMISSIONS: { role: Role; title: string; desc: string; badge: string }[] = [
    {
      role: 'owner',
      title: t.team.roles.owner.title,
      desc: t.team.roles.owner.desc,
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      role: 'admin',
      title: t.team.roles.admin.title,
      desc: t.team.roles.admin.desc,
      badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      role: 'member',
      title: t.team.roles.member.title,
      desc: t.team.roles.member.desc,
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      role: 'viewer',
      title: t.team.roles.viewer.title,
      desc: t.team.roles.viewer.desc,
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
  ];

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite_member',
          workspaceId: currentWorkspace.id,
          inviteEmail: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteSuccess(t.team.invitationSent || `Invitation sent to ${inviteEmail}!`);
        await refreshData();
        setTimeout(() => {
          setIsInviteOpen(false);
          setInviteSuccess(null);
          setInviteEmail('');
        }, 1500);
      }
    } catch {
      setInviteSuccess('Error inviting member.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-100">{t.team.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t.team.subtitle}
          </p>
        </div>

        <button
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.team.inviteButton}</span>
        </button>
      </div>

      {/* Role Hierarchy Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLE_PERMISSIONS.map((rp) => (
          <div key={rp.role} className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${rp.badge}`}>
                {rp.title}
              </span>
              <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-500" />
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">{rp.desc}</p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.team.membersCount} ({allUsers.length})</h3>
          <span className="text-2xs text-slate-500 dark:text-neutral-500">Tenant: {currentWorkspace.name}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-neutral-950/80 border-b border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-5 py-3">{t.team.colMember}</th>
                <th className="px-4 py-3">{t.team.colEmail}</th>
                <th className="px-4 py-3">{t.team.colRole}</th>
                <th className="px-4 py-3">{t.team.colStatus}</th>
                <th className="px-4 py-3 text-right">{t.team.colPerspective}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-neutral-800/60 text-slate-600 dark:text-neutral-300">
              {allUsers.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const roleMeta = ROLE_PERMISSIONS.find((r) => r.role === user.role);

                return (
                  <tr key={user.id} className="hover:bg-slate-100/50 dark:hover:bg-neutral-850/50 transition-colors">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <div className="relative">
                        <Avatar
                          src={user.avatar}
                          name={user.name}
                          color={user.color}
                          className="w-8 h-8 rounded-full object-cover border"
                        />
                        {isCurrent && (
                          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-300 dark:border-neutral-900" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-neutral-100 flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {isCurrent && (
                            <span className="text-3xs font-mono bg-indigo-500/20 text-indigo-400 px-1.5 py-0.2 rounded">
                              {t.common.you}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-neutral-400 font-mono">{user.email}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${roleMeta?.badge}`}>
                        {roleMeta?.title}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-300">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            user.status === 'online'
                              ? 'bg-emerald-400'
                              : user.status === 'idle'
                              ? 'bg-amber-400'
                              : 'bg-slate-300 dark:bg-neutral-600'
                          }`}
                        />
                        <span>
                          {user.status === 'online' && t.team.statusOnline}
                          {user.status === 'idle' && t.team.statusIdle}
                          {user.status === 'offline' && t.team.statusOffline}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isCurrent && (
                        <span className="text-2xs font-semibold text-emerald-400 px-2.5 py-1 bg-emerald-500/10 rounded-lg">
                          {t.team.activePersonaBadge}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-100">{t.team.inviteModalTitle}</h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1.5 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.team.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 dark:text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@agency.io"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {t.team.roleLabel}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-neutral-100 focus:outline-hidden"
                >
                  <option value="member">{t.team.memberRoleDesc}</option>
                  <option value="admin">{t.team.adminRoleDesc}</option>
                  <option value="viewer">{t.team.viewerRoleDesc}</option>
                </select>
              </div>

              {inviteSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                  {inviteSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isInviting ? t.common.loading : t.team.sendInvite}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
