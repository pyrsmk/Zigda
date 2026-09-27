import { handler, send } from '../_lib/http.js'
import { loadThreads } from '../_lib/threads.js'

export default handler({
  GET: async (req, res) => {
    const threads = await loadThreads(
      `id in (select id from threads order by updated_at desc limit 20)`,
      [],
    )
    threads.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    send(res, 200, { threads })
  },
})
