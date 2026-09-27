import { handler, send } from '../_lib/http.js'
import { repoContext, tree } from '../_lib/repo.js'

export default handler({
  GET: async (req, res) => {
    const ctx = await repoContext()
    send(res, 200, await tree(ctx))
  },
})
