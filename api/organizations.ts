import { rejectForeignOrigin } from '../src/server/request-origin.js'
import { authPool, getSession } from '../src/server/auth.js'

export async function handler(request: Request): Promise<Response> {
  const originError = rejectForeignOrigin(request)
  if (originError) return originError
  const session = await getSession(request)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (request.method === 'GET') {
    const result = await authPool.query(
      'SELECT o.id, o.name, o.slug, m.role FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.user_id = $1 ORDER BY o.name',
      [session.user.id],
    )
    return Response.json(result.rows)
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!name || name.length > 200 || !/^[a-z0-9-]{3,60}$/.test(slug)) return Response.json({ error: 'name and valid slug are required' }, { status: 400 })

    const client = await authPool.connect()
    try {
      await client.query('BEGIN')
      const organization = await client.query(
        'INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3) RETURNING id, name, slug',
        [crypto.randomUUID(), name, slug],
      )
      await client.query(
        'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,$3)',
        [organization.rows[0].id, session.user.id, 'ADMIN'],
      )
      await client.query('COMMIT')
      return Response.json({ ...organization.rows[0], role: 'ADMIN' }, { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string }).code === '23505') return Response.json({ error: 'Organization slug already exists' }, { status: 409 })
      return Response.json({ error: 'Unable to create organization' }, { status: 500 })
    } finally {
      client.release()
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

export default { fetch: handler }
