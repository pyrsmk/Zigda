import { handler, send } from '../_lib/http.js'
import { query } from '../_lib/db.js'
import { repoContext, tree } from '../_lib/repo.js'
import { purgePath } from '../_lib/threads.js'

export default handler({
  GET: async (req, res) => {
    const ctx = await repoContext()
    const result = await tree(ctx)
    if (!result.truncated) {
      const files = new Set(result.entries.filter((e) => e.type === 'blob').map((e) => e.path))
      const paths = await query('select distinct path from threads')
      for (const { path } of paths) if (!files.has(path)) await purgePath(path)
    }
    send(res, 200, result)
  },
})
