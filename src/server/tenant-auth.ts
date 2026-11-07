import { authPool, getSession } from './auth.js'

export type OrganizationRole = 'ADMIN' | 'OPERATOR' | 'VIEWER'

export async function requireOrganizationAccess(request: Request, organizationId: string, roles?: OrganizationRole[]) {
  const session = await getSession(request)
  if (!session?.user) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) as Response }

  const result = await authPool.query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
    [organizationId, session.user.id],
  )
  const role = result.rows[0]?.role as OrganizationRole | undefined
  if (!role || (roles && !roles.includes(role))) {
    return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) as Response }
  }

  return { session, role }
}
