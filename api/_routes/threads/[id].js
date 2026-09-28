import { body, handler, HttpError, param, send } from '../../_lib/http.js'
import { readFile, repoContext } from '../../_lib/repo.js'
import { loadThread, addMessage, isTaken, setThreadStatus } from '../../_lib/threads.js'
import { locate } from '../../../shared/anchor.js'

async function checkReopen(thread) {
  if (thread.proposals.some((p) => p.status === 'applied')) {
    throw new HttpError(409, 'thread_applied', 'A version of this passage has already been applied')
  }
  const current = await readFile(await repoContext(), thread.path)
  const place = current && !current.binary ? locate(current.content, thread.anchor) : null
  if (!place) throw new HttpError(409, 'passage_missing', 'The passage no longer exists')
  if (await isTaken(thread.path, current.content, place, thread.id)) {
    throw new HttpError(409, 'passage_taken', 'This passage is already under discussion')
  }
}

export default handler({
  GET: async (req, res) => {
    send(res, 200, { thread: await loadThread(param(req, 'id')) })
  },
  PATCH: async (req, res) => {
    const thread = await loadThread(param(req, 'id'))
    const { status } = await body(req)
    if (!['open', 'resolved'].includes(status)) throw new HttpError(400, 'invalid_status', 'Invalid status')
    if (thread.kind !== 'passage') throw new HttpError(400, 'not_a_discussion', 'Proposals close through a decision')
    if (status === 'resolved' && thread.proposals.some((p) => ['pending', 'conflict', 'applying'].includes(p.status))) {
      throw new HttpError(409, 'versions_pending', 'Some versions are still waiting for a decision')
    }
    if (thread.status !== status) {
      if (status === 'open') await checkReopen(thread)
      await setThreadStatus(thread.id, status, req.user.id)
      await addMessage(thread.id, req.user.id, status === 'resolved' ? 'resolved' : 'reopened', 'event')
    }
    send(res, 200, { thread: await loadThread(thread.id) })
  },
})
