import { body, handler, HttpError, param, send } from '../_lib/http.js'
import { one } from '../_lib/db.js'
import { createThread, loadThread, loadThreads } from '../_lib/threads.js'

function checkAnchor(anchor) {
  const valid =
    anchor &&
    Number.isInteger(anchor.start) &&
    Number.isInteger(anchor.end) &&
    anchor.end > anchor.start &&
    typeof anchor.quote === 'string' &&
    anchor.quote.length === anchor.end - anchor.start
  if (!valid) throw new HttpError(400, 'invalid_anchor', 'A text selection is required')
  return {
    start: anchor.start,
    end: anchor.end,
    quote: anchor.quote,
    prefix: String(anchor.prefix ?? ''),
    suffix: String(anchor.suffix ?? ''),
  }
}

export default handler({
  GET: async (req, res) => {
    const path = param(req, 'path')
    if (!path) throw new HttpError(400, 'path_required', 'A path is required')
    send(res, 200, { threads: await loadThreads(`path = $1 and kind <> 'proposal'`, [path]) })
  },
  POST: async (req, res) => {
    const input = await body(req)
    const kind = input.kind === 'suggestion' ? 'suggestion' : 'comment'
    if (!input.path || !input.baseSha) throw new HttpError(400, 'path_required', 'A path and a sha are required')
    const anchor = checkAnchor(input.anchor)
    if (kind === 'comment' && !input.body?.trim()) throw new HttpError(400, 'body_required', 'A message is required')
    if (kind === 'suggestion' && (typeof input.replacement !== 'string' || input.replacement === anchor.quote)) {
      throw new HttpError(400, 'replacement_required', 'The suggestion must change the text')
    }

    const thread = await createThread({
      path: input.path,
      kind,
      anchor,
      baseSha: input.baseSha,
      userId: req.user.id,
      body: input.body,
    })
    if (kind === 'suggestion') {
      await one(
        `insert into proposals (thread_id, path, action, base_sha, base_content, content, author_id)
         values ($1, $2, 'replace', $3, $4, $5, $6) returning id`,
        [thread.id, input.path, input.baseSha, anchor.quote, input.replacement, req.user.id],
      )
    }
    send(res, 201, { thread: await loadThread(thread.id) })
  },
})
