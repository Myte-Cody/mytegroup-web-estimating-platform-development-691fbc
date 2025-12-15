export type Role =
  | 'superadmin'
  | 'platform_admin'
  | 'org_owner'
  | 'org_admin'
  | 'admin'
  | 'manager'
  | 'compliance_officer'
  | 'security_officer'
  | 'pm'
  | 'estimator'
  | 'engineer'
  | 'detailer'
  | 'transporter'
  | 'foreman'
  | 'superintendent'
  | 'qaqc'
  | 'hs'
  | 'purchasing'
  | 'compliance'
  | 'security'
  | 'finance'
  | 'viewer'
  | 'user'

export type SessionRoleInput = {
  role?: string
  roles?: string[]
}

const BASE_ROLES: Role[] = [
  'manager',
  'compliance_officer',
  'security_officer',
  'pm',
  'estimator',
  'engineer',
  'detailer',
  'transporter',
  'foreman',
  'superintendent',
  'qaqc',
  'hs',
  'purchasing',
  'compliance',
  'security',
  'finance',
  'viewer',
  'user',
]

export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  superadmin: [
    'superadmin',
    'platform_admin',
    'org_owner',
    'org_admin',
    'admin',
    ...BASE_ROLES,
  ],
  platform_admin: [
    'platform_admin',
    'org_owner',
    'org_admin',
    'admin',
    ...BASE_ROLES,
  ],
  org_owner: ['org_owner', 'org_admin', 'admin', ...BASE_ROLES],
  org_admin: ['org_admin', 'admin', ...BASE_ROLES],
  admin: ['admin', ...BASE_ROLES],
  manager: ['manager', 'viewer', 'user'],
  viewer: ['viewer', 'user'],
  compliance_officer: ['compliance_officer', 'compliance', 'user'],
  security_officer: ['security_officer', 'security', 'user'],
  pm: ['pm', 'viewer', 'user'],
  estimator: ['estimator', 'viewer', 'user'],
  engineer: ['engineer', 'viewer', 'user'],
  detailer: ['detailer', 'viewer', 'user'],
  transporter: ['transporter', 'viewer', 'user'],
  foreman: ['foreman', 'viewer', 'user'],
  superintendent: ['superintendent', 'viewer', 'user'],
  qaqc: ['qaqc', 'viewer', 'user'],
  hs: ['hs', 'viewer', 'user'],
  purchasing: ['purchasing', 'viewer', 'user'],
  compliance: ['compliance', 'viewer', 'user'],
  security: ['security', 'viewer', 'user'],
  finance: ['finance', 'viewer', 'user'],
  user: ['user'],
}

const normalizeRoles = (roles: Array<string | undefined | null>) => {
  return Array.from(
    new Set(
      roles
        .map((r) => (r || '').trim())
        .filter(Boolean)
    )
  )
}

export const expandRoles = (roles: Array<string | undefined | null>) => {
  const expanded = new Set<string>()
  normalizeRoles(roles).forEach((role) => {
    const implied = ROLE_HIERARCHY[role as Role] || [role]
    implied.forEach((r) => expanded.add(r))
  })
  return Array.from(expanded)
}

export const getEffectiveRoles = (input?: SessionRoleInput | null) => {
  return expandRoles([...(input?.roles || []), input?.role])
}

export const hasAnyRole = (input: SessionRoleInput | null | undefined, required: string[] | undefined) => {
  if (!required || required.length === 0) return true
  const effective = getEffectiveRoles(input)
  return required.some((role) => effective.includes(role))
}

