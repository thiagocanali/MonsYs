import { authPool, getSession, type AuthSession } from './auth.js'

export type OrganizationRole = 'ADMIN' | 'OPERATOR' | 'VIEWER'
type OrganizationAccess = { response: Response } | { session: AuthSession; role: OrganizationRole }

export function roleAllows(role: OrganizationRole | undefined, requiredRoles?: OrganizationRole[]) {
  return Boolean(role && (!requiredRoles || requiredRoles.includes(role)))
}

export async function requireOrganizationAccess(
  request: Request,
  organizationId: string,
  roles?: OrganizationRole[],
): Promise<OrganizationAccess> {
  const session = await getSession(request)
  if (!session?.user) {
    return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const result = await authPool.query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
    [organizationId, session.user.id],
  )
  const role = result.rows[0]?.role as OrganizationRole | undefined
  if (!role || !roleAllows(role, roles)) {
    return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session, role }
}
