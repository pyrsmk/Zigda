import { HttpError } from './http.js'

export const GITHUB_URL = process.env.GITHUB_URL || 'https://github.com'
export const GITHUB_API_URL = process.env.GITHUB_API_URL || 'https://api.github.com'

export class GithubError extends HttpError {}

export async function gh(token, path, { method = 'GET', body, accept = 'application/vnd.github+json', raw = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${GITHUB_API_URL}${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Zigda',
      ...(body ? { 'Content-Type': 'application/json' } : null),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) return raw ? res : res.status === 204 ? null : res.json()

  const detail = await res.json().catch(() => ({}))
  const message = detail.message ?? `GitHub answered ${res.status}`
  if (res.status === 401) throw new GithubError(502, 'github_token_invalid', message)
  if (res.status === 404) throw new GithubError(404, 'github_not_found', message)
  if (res.status === 409 || (res.status === 422 && /sha/i.test(message))) {
    throw new GithubError(409, 'github_conflict', message)
  }
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new GithubError(429, 'github_rate_limited', message)
  }
  throw new GithubError(502, 'github_error', message)
}

export async function exchangeCode(code, redirectUri) {
  const res = await fetch(`${GITHUB_URL}/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.access_token) throw new HttpError(401, 'oauth_failed', data.error_description ?? 'OAuth exchange failed')
  return { token: data.access_token, scopes: (data.scope ?? '').split(/[,\s]+/).filter(Boolean) }
}
