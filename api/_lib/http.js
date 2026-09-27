import { currentUser } from './session.js'

export class HttpError extends Error {
  constructor(status, code, message = code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function handler(routes, { auth = 'member' } = {}) {
  return async (req, res) => {
    const method = req.method?.toUpperCase()
    const route = routes[method]
    if (!route) {
      res.setHeader('Allow', Object.keys(routes).join(', '))
      return send(res, 405, { code: 'method_not_allowed', error: `Method ${method} not supported` })
    }
    try {
      if (auth !== 'none') {
        req.user = await currentUser(req)
        if (!req.user) return send(res, 401, { code: 'unauthenticated', error: 'Authentication required' })
        if (auth === 'root' && req.user.role !== 'root') {
          return send(res, 403, { code: 'forbidden', error: 'Reserved to the app owner' })
        }
      }
      await route(req, res)
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { code: err.code, error: err.message })
      console.error(`[${method} ${req.url}]`, err)
      send(res, 500, { code: 'server_error', error: err.message ?? 'Unexpected error' })
    }
  }
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function redirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

export function param(req, name) {
  return req.query?.[name] ?? new URL(req.url, 'http://x').searchParams.get(name)
}

export function origin(req) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0] ?? (req.socket?.encrypted ? 'https' : 'http')
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return `${proto}://${host}`
}
