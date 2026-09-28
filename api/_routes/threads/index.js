import { body, handler, HttpError, param, send } from '../../_lib/http.js'
import { readFile, repoContext } from '../../_lib/repo.js'
import { createThread, isTaken, loadThread, loadThreads, purgePath } from '../../_lib/threads.js'
import { addVersion } from '../../_lib/proposals.js'
import { locate, makeAnchor } from '../../../shared/anchor.js'

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
    send(res, 200, { threads: await loadThreads(`path = $1 and kind = 'passage'`, [path]) })
  },
  POST: async (req, res) => {
    const input = await body(req)
    if (!input.path) throw new HttpError(400, 'path_required', 'A path is required')
    const anchor = checkAnchor(input.anchor)
    const proposing = typeof input.replacement === 'string' && input.replacement !== anchor.quote
    if (!input.body?.trim() && !proposing) {
      throw new HttpError(400, 'body_required', 'Write a message or propose a modification')
    }

    const current = await readFile(await repoContext(), input.path)
    if (!current) {
      await purgePath(input.path)
      throw new HttpError(404, 'file_not_found', 'File not found')
    }
    if (current.binary) throw new HttpError(400, 'file_binary', 'Binary files cannot be discussed')
    const place = locate(current.content, anchor)
    if (!place) throw new HttpError(409, 'passage_missing', 'The passage has changed, reload the file')
    if (await isTaken(input.path, current.content, place)) {
      throw new HttpError(409, 'passage_taken', 'This passage is already under discussion')
    }

    const thread = await createThread({
      path: input.path,
      kind: 'passage',
      anchor: makeAnchor(current.content, place.start, place.end),
      baseSha: current.sha,
      userId: req.user.id,
      body: input.body,
    })
    if (proposing) await addVersion(thread.id, req.user, { content: input.replacement }, { announce: false })
    send(res, 201, { thread: await loadThread(thread.id) })
  },
})
