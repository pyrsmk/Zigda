import { handler, HttpError, param, send } from '../../_lib/http.js'
import { query } from '../../_lib/db.js'
import { applyCompletedProposals, cancelAuthorProposals } from '../../_lib/proposals.js'
import { cleanupAlerts } from '../../_lib/alerts.js'

export default handler(
  {
    DELETE: async (req, res) => {
      const login = param(req, 'login').toLowerCase()
      const users = await query(`select * from users where lower(login) = $1 and active`, [login])
      if (users.some((u) => u.role === 'root')) throw new HttpError(400, 'cannot_remove_owner', 'The owner stays')
      await query(`update users set active = false where lower(login) = $1 and role <> 'root'`, [login])
      await query('delete from invitations where login = $1', [login])
      for (const user of users) await cancelAuthorProposals(user.id, req.user)
      if (users.length) await applyCompletedProposals(req.user)
      await cleanupAlerts()
      send(res, 200, { ok: true })
    },
  },
  { auth: 'root' },
)
