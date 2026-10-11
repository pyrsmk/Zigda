import { body, handler, HttpError, send } from '../../_lib/http.js'
import { readFile, repoContext } from '../../_lib/repo.js'
import { checkAnchor, isTaken } from '../../_lib/threads.js'
import { acquireLock } from '../../_lib/locks.js'
import { locate, makeAnchor } from '../../../shared/anchor.js'

export default handler({
  POST: async (req, res) => {
    const input = await body(req)
    if (!input.path) throw new HttpError(400, 'path_required', 'A path is required')
    const anchor = checkAnchor(input.anchor)
    const current = await readFile(await repoContext(), input.path)
    if (!current) throw new HttpError(404, 'file_not_found', 'File not found')
    if (current.binary) throw new HttpError(400, 'file_binary', 'Binary files cannot be edited')
    const place = locate(current.content, anchor)
    if (!place) throw new HttpError(409, 'passage_missing', 'The passage has changed, reload the file')
    if (await isTaken(input.path, current.content, place)) {
      throw new HttpError(409, 'passage_taken', 'This passage is already under discussion')
    }
    const lock = await acquireLock(
      input.path,
      current.content,
      place,
      makeAnchor(current.content, place.start, place.end),
      req.user.id,
    )
    send(res, 201, { lock })
  },
})
