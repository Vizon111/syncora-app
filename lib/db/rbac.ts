import { Role } from '@/lib/types';

export type Permission =
  | 'workspace:delete'
  | 'workspace:update'
  | 'workspace:invite'
  | 'workspace:manage_roles'
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'task:create'
  | 'task:update'
  | 'task:delete'
  | 'document:create'
  | 'document:edit'
  | 'document:delete'
  | 'comment:create'
  | 'comment:resolve'
  | 'comment:delete'
  | 'file:upload'
  | 'file:delete'
  | 'ai:query'
  | 'ai:execute_action';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'workspace:delete',
    'workspace:update',
    'workspace:invite',
    'workspace:manage_roles',
    'project:create',
    'project:update',
    'project:delete',
    'task:create',
    'task:update',
    'task:delete',
    'document:create',
    'document:edit',
    'document:delete',
    'comment:create',
    'comment:resolve',
    'comment:delete',
    'file:upload',
    'file:delete',
    'ai:query',
    'ai:execute_action',
  ],
  admin: [
    'workspace:update',
    'workspace:invite',
    'project:create',
    'project:update',
    'project:delete',
    'task:create',
    'task:update',
    'task:delete',
    'document:create',
    'document:edit',
    'document:delete',
    'comment:create',
    'comment:resolve',
    'comment:delete',
    'file:upload',
    'file:delete',
    'ai:query',
    'ai:execute_action',
  ],
  member: [
    'project:create',
    'project:update',
    'task:create',
    'task:update',
    'document:create',
    'document:edit',
    'comment:create',
    'comment:resolve',
    'file:upload',
    'ai:query',
    'ai:execute_action',
  ],
  viewer: [
    'ai:query', // viewers can search and ask questions, but cannot mutate data
  ],
};

/**
 * Server-side RBAC validation helper
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Compare role hierarchy (owner > admin > member > viewer)
 */
export function getRoleRank(role: Role): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'member':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }
  return false;
}
