import { handler, send } from '../_lib/http.js'
import { query } from '../_lib/db.js'

export default handler({
  GET: async (req, res) => {
    const threads = await query(
      `select t.path,
              exists (select 1 from proposals p where p.thread_id = t.id
                        and p.status in ('pending', 'conflict', 'applying')) as proposing
         from threads t
        where t.status = 'open'`,
    )
    const files = {}
    for (const row of threads) {
      files[row.path] ??= { comments: 0, proposals: 0 }
      files[row.path][row.proposing ? 'proposals' : 'comments']++
    }
    const toReview = await query(
      `select count(*)::int as count from proposals p
        where p.status = 'pending' and p.author_id <> $1
          and not exists (select 1 from approvals a where a.proposal_id = p.id and a.user_id = $1)`,
      [req.user.id],
    )
    send(res, 200, { files, toReview: toReview[0].count })
  },
})
