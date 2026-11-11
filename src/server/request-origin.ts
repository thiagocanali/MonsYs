/** Cookie-authenticated mutations must not accept a foreign browser origin. */
export function rejectForeignOrigin(request: Request): Response | undefined {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Forbidden origin' }, { status: 403 })
  }
}
