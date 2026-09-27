import { handler, send } from './_lib/http.js'
import { settings } from './_lib/repo.js'
import { publicUser } from './_lib/session.js'
import { one } from './_lib/db.js'

export default handler({
  GET: async (req, res) => {
    const config = await settings()
    const root = await one(`select * from users where role = 'root'`)
    send(res, 200, {
      user: publicUser(req.user),
      owner: publicUser(root),
      repo: config?.repo_name ? { owner: config.repo_owner, name: config.repo_name, branch: config.branch } : null,
      tokenReady: Boolean(config?.github_token),
    })
  },
})
