import { handler, origin, param, redirect } from '../../_lib/http.js'
import { exchangeCode, gh } from '../../_lib/github.js'
import { one, query } from '../../_lib/db.js'
import { cookies, openSession, setCookie } from '../../_lib/session.js'
import { saveRootToken, settings } from '../../_lib/repo.js'

async function upsertProfile(profile, role) {
  return one(
    `insert into users (id, login, name, avatar_url, role) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set login = $2, name = $3, avatar_url = $4, active = true
     returning *`,
    [profile.id, profile.login, profile.name, profile.avatar_url, role],
  )
}

async function claimRoot(profile) {
  try {
    return await upsertProfile(profile, 'root')
  } catch (err) {
    if (err.code === '23505') return null
    throw err
  }
}

export default handler(
  {
    GET: async (req, res) => {
      const state = param(req, 'state')
      setCookie(res, req, 'hg_oauth_state', '', 0)
      if (!state || state !== cookies(req).hg_oauth_state || !param(req, 'code')) {
        return redirect(res, '/login?error=oauth')
      }

      const { token, scopes } = await exchangeCode(param(req, 'code'), `${origin(req)}/api/auth/callback`)
      const profile = await gh(token, '/user')
      const hasRepoScope = scopes.includes('repo')

      let user = await one('select * from users where id = $1', [profile.id])
      const root = await one(`select id from users where role = 'root'`)

      if (!root) {
        if (!hasRepoScope) return redirect(res, '/api/auth/login?scope=repo')
        user = await claimRoot(profile)
        if (!user) return redirect(res, '/login?error=oauth')
      } else if (user?.active) {
        user = await upsertProfile(profile, user.role)
      } else {
        const invitation = await one('select * from invitations where login = $1', [profile.login.toLowerCase()])
        if (!invitation) return redirect(res, `/login?error=invitation&account=${encodeURIComponent(profile.login)}`)
        user = await upsertProfile(profile, 'member')
        await query('delete from invitations where login = $1', [invitation.login])
      }

      if (user.role === 'root' && hasRepoScope) await saveRootToken(token)
      await openSession(res, req, user.id)

      const config = await settings()
      redirect(res, user.role === 'root' && !config?.repo_name ? '/setup' : '/')
    },
  },
  { auth: 'none' },
)
