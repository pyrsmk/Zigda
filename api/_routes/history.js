import { handler, HttpError, param, send } from '../_lib/http.js'
import { commit, history, repoContext } from '../_lib/repo.js'

export default handler({
  GET: async (req, res) => {
    const path = param(req, 'path')
    if (!path) throw new HttpError(400, 'path_required', 'A path is required')
    const ctx = await repoContext()
    const sha = param(req, 'sha')
    if (sha) return send(res, 200, { commit: await commit(ctx, sha, path) })
    send(res, 200, { commits: await history(ctx, path) })
  },
})
