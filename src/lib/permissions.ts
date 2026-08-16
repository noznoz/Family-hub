/** System roles and granular permission keys (mirror the DB reference data). */
export type SystemRole = 'admin' | 'parent' | 'student' | 'family_member';

export const PERMISSIONS = [
  'view_family_chat',
  'send_family_messages',
  'view_student_profile',
  'view_student_finances',
  'manage_student_finances',
  'approve_payment_requests',
  'view_documents',
  'manage_documents',
  'view_travel',
  'manage_travel',
  'view_scholarship',
  'manage_scholarship',
  'view_support',
  'create_support',
  'edit_support',
  'manage_family_members',
  'manage_permissions',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Role default permissions — mirrors supabase/migrations/0003. */
export const ROLE_DEFAULTS: Record<SystemRole, Permission[]> = {
  admin: [...PERMISSIONS],
  parent: [
    'view_family_chat',
    'send_family_messages',
    'view_student_profile',
    'view_student_finances',
    'manage_student_finances',
    'approve_payment_requests',
    'view_documents',
    'manage_documents',
    'view_travel',
    'manage_travel',
    'view_scholarship',
    'manage_scholarship',
    'view_support',
    'create_support',
    'edit_support',
    'manage_family_members',
  ],
  student: [
    'view_family_chat',
    'send_family_messages',
    'view_student_profile',
    'view_travel',
    'view_documents',
    'view_scholarship',
    'view_support',
    'create_support',
  ],
  family_member: [
    'view_family_chat',
    'send_family_messages',
    'view_student_profile',
    'view_travel',
    'view_support',
  ],
};

/** Resolve effective permission: per-member override wins over role default. */
export function can(
  role: SystemRole,
  permission: Permission,
  overrides: Partial<Record<Permission, boolean>> = {},
): boolean {
  if (role === 'admin') return true;
  if (permission in overrides) return overrides[permission]!;
  return ROLE_DEFAULTS[role].includes(permission);
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_family_chat: 'View family chat',
  send_family_messages: 'Send family messages',
  view_student_profile: 'View student profiles',
  view_student_finances: 'View student finances',
  manage_student_finances: 'Manage student finances',
  approve_payment_requests: 'Approve payment requests',
  view_documents: 'View documents',
  manage_documents: 'Manage documents',
  view_travel: 'View travel',
  manage_travel: 'Manage travel',
  view_scholarship: 'View scholarship',
  manage_scholarship: 'Manage scholarship',
  view_support: 'View support guides',
  create_support: 'Create support guides',
  edit_support: 'Edit support guides',
  manage_family_members: 'Manage family members',
  manage_permissions: 'Manage permissions',
};
