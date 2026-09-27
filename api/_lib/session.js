import { SignJWT, jwtVerify } from 'jose'
import { one, query } from './db.js'

const COOKIE = 'hg_session'
const MAX_AGE = 60 * 60 * 24 * 30

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET is missing')
  return new TextEncoder().encode(value)
}

export function cookies(req) {
  const out = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

export function setCookie(res, req, name, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] ?? '').startsWith('https') ? '; Secure' : ''
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  const existing = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', existing ? [].concat(existing, cookie) : cookie)
}

export async function openSession(res, req, userId) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
  setCookie(res, req, COOKIE, token, MAX_AGE)
}

export function closeSession(res, req) {
  setCookie(res, req, COOKIE, '', 0)
}

export async function currentUser(req) {
  const token = cookies(req)[COOKIE]
  if (!token) return null
  let userId
  try {
    const { payload } = await jwtVerify(token, secret())
    userId = payload.sub
  } catch {
    return null
  }
  const user = await one('select * from users where id = $1 and active', [userId])
  if (user && (!user.last_seen_at || Date.now() - new Date(user.last_seen_at) > 5 * 60_000)) {
    await query('update users set last_seen_at = now() where id = $1', [user.id])
  }
  return user
}

export function publicUser(user) {
  if (!user) return null
  return { id: Number(user.id), login: user.login, name: user.name, avatar_url: user.avatar_url, role: user.role }
}
