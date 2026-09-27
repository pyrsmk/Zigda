import { body, handler, HttpError, send } from '../../_lib/http.js'
import { gh } from '../../_lib/github.js'
import { rootToken, saveRepo, splitRepo } from '../../_lib/repo.js'

export default handler(
  {
    POST: async (req, res) => {
      const { repo, branch } = await body(req)
      const { owner, name } = splitRepo(repo)
      if (!branch) throw new HttpError(400, 'branch_required', 'A branch is required')
      const token = await rootToken()
      const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
      const info = await gh(token, base)
      if (!info.permissions?.push) throw new HttpError(403, 'repo_read_only', 'No write access to this repository')
      await gh(token, `${base}/branches/${encodeURIComponent(branch)}`)
      await saveRepo(info.owner.login, info.name, branch)
      send(res, 200, { repo: { owner: info.owner.login, name: info.name, branch } })
    },
  },
  { auth: 'root' },
)
