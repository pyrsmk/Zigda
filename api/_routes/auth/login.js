import { randomBytes } from 'node:crypto'
import { handler, origin, param, redirect } from '../../_lib/http.js'
import { GITHUB_URL } from '../../_lib/github.js'
import { one } from '../../_lib/db.js'
import { setCookie } from '../../_lib/session.js'

export default handler(
  {
    GET: async (req, res) => {
      const root = await one(`select id from users where role = 'root'`)
      const wantsRepo = !root || param(req, 'scope') === 'repo'
      const state = randomBytes(16).toString('hex')
      setCookie(res, req, 'hg_oauth_state', state, 600)
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: `${origin(req)}/api/auth/callback`,
        scope: wantsRepo ? 'repo read:user' : 'read:user',
        state,
        allow_signup: 'true',
      })
      redirect(res, `${GITHUB_URL}/login/oauth/authorize?${params}`)
    },
  },
  { auth: 'none' },
)
