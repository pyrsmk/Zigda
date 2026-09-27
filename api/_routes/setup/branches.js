import { handler, param, send } from '../../_lib/http.js'
import { gh } from '../../_lib/github.js'
import { rootToken, splitRepo } from '../../_lib/repo.js'

export default handler(
  {
    GET: async (req, res) => {
      const { owner, name } = splitRepo(param(req, 'repo'))
      const token = await rootToken()
      const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
      const [repo, branches] = await Promise.all([gh(token, base), gh(token, `${base}/branches?per_page=100`)])
      send(res, 200, { default_branch: repo.default_branch, branches: branches.map((b) => b.name) })
    },
  },
  { auth: 'root' },
)
