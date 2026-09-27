import { handler, send } from '../../_lib/http.js'
import { gh } from '../../_lib/github.js'
import { rootToken } from '../../_lib/repo.js'

export default handler(
  {
    GET: async (req, res) => {
      const token = await rootToken()
      const repos = []
      for (let page = 1; page <= 5; page++) {
        const params = new URLSearchParams({
          per_page: '100',
          page: String(page),
          sort: 'updated',
          affiliation: 'owner,collaborator,organization_member',
        })
        const batch = await gh(token, `/user/repos?${params}`)
        repos.push(...batch)
        if (batch.length < 100) break
      }
      send(res, 200, {
        repos: repos
          .filter((r) => r.permissions?.push)
          .map((r) => ({
            full_name: r.full_name,
            owner: r.owner.login,
            name: r.name,
            private: r.private,
            description: r.description,
            default_branch: r.default_branch,
            updated_at: r.pushed_at,
          })),
      })
    },
  },
  { auth: 'root' },
)
