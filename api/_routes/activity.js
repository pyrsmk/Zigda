import { handler, send } from '../_lib/http.js'
import { query } from '../_lib/db.js'
import { loadThreads } from '../_lib/threads.js'

export default handler({
  GET: async (req, res) => {
    const [threads, removals] = await Promise.all([
      loadThreads(`id in (select id from threads order by updated_at desc limit 20)`, []),
      query('select id, path, discussions, created_at from file_removals order by created_at desc limit 20'),
    ])
    threads.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    send(res, 200, { threads, removals })
  },
})
