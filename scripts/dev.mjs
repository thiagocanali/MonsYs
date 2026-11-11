import { createServer, loadEnv } from 'vite'
Object.assign(process.env, loadEnv('development', process.cwd(), ''))
function configureServer(server) {
server.middlewares.use(async (req, res, next) => {
  if (!req.url.startsWith('/api/')) return next()
  try {
    const pathname = new URL(req.url, 'http://localhost:3000').pathname
    const name = pathname.startsWith('/api/auth/') ? 'auth' : pathname.split('/').pop()
    if (!['auth','agents','organizations','operations','health'].includes(name)) { res.statusCode = 404; return res.end() }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    const request = new Request(`http://localhost:3000${req.url}`, { method: req.method, headers: req.headers, ...(body.length ? {body} : {}) })
    const module = await server.ssrLoadModule(`/api/${name}.ts`)
    const response = await module.default.fetch(request)
    res.statusCode = response.status
    for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value)
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) { console.error(error); res.statusCode = 500; res.end('Internal server error') }
})
}
const server = await createServer({ plugins: [{ name: 'monsys-local-api', configureServer }], server: { host: '127.0.0.1', port: 3000, strictPort: true }, appType: 'spa' })
await server.listen()
console.log('Local integrated test server at http://localhost:3000')
