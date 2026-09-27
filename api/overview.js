import { handler, send } from './_lib/http.js'
import { query } from './_lib/db.js'

export default handler({
  GET: async (req, res) => {
    const threads = await query(
      `select t.path, t.kind, count(*)::int as count
         from threads t left join proposals p on p.thread_id = t.id
        where t.status = 'open' and (p.id is null or p.status in ('pending', 'conflict', 'applying'))
        group by t.path, t.kind`,
    )
    const files = {}
    for (const row of threads) {
      files[row.path] ??= { comments: 0, proposals: 0 }
      files[row.path][row.kind === 'comment' ? 'comments' : 'proposals'] += row.count
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
