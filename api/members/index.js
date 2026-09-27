import { body, handler, HttpError, send } from '../_lib/http.js'
import { gh, GithubError } from '../_lib/github.js'
import { one, query } from '../_lib/db.js'
import { rootToken } from '../_lib/repo.js'
import { publicUser } from '../_lib/session.js'

export default handler(
  {
    GET: async (req, res) => {
      const members = await query('select * from users where active order by role desc, created_at')
      const invitations = await query('select login, avatar_url, created_at from invitations order by created_at')
      send(res, 200, {
        members: members.map((u) => ({ ...publicUser(u), last_seen_at: u.last_seen_at })),
        invitations,
      })
    },
    POST: async (req, res) => {
      const login = String((await body(req)).login ?? '')
        .trim()
        .replace(/^@/, '')
      if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) throw new HttpError(400, 'invalid_login', 'Invalid GitHub login')

      let profile
      try {
        profile = await gh(await rootToken(), `/users/${encodeURIComponent(login)}`)
      } catch (err) {
        if (err instanceof GithubError && err.code === 'github_not_found') {
          throw new HttpError(404, 'github_user_not_found', 'No GitHub account with this login')
        }
        throw err
      }
      const existing = await one('select * from users where id = $1 and active', [profile.id])
      if (existing) throw new HttpError(409, 'already_member', 'Already a member')

      await query(
        `insert into invitations (login, github_id, avatar_url, invited_by) values ($1, $2, $3, $4)
         on conflict (login) do update set github_id = $2, avatar_url = $3`,
        [profile.login.toLowerCase(), profile.id, profile.avatar_url, req.user.id],
      )
      send(res, 201, { ok: true })
    },
  },
  { auth: 'root' },
)
