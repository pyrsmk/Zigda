import { body, handler, HttpError, param, send } from '../_lib/http.js'
import { loadThread, addMessage, setThreadStatus } from '../_lib/threads.js'

export default handler({
  GET: async (req, res) => {
    send(res, 200, { thread: await loadThread(param(req, 'id')) })
  },
  PATCH: async (req, res) => {
    const thread = await loadThread(param(req, 'id'))
    const { status } = await body(req)
    if (!['open', 'resolved'].includes(status)) throw new HttpError(400, 'invalid_status', 'Invalid status')
    if (thread.kind !== 'comment') throw new HttpError(400, 'not_a_comment', 'Proposals close through a decision')
    if (thread.status !== status) {
      await setThreadStatus(thread.id, status, req.user.id)
      await addMessage(thread.id, req.user.id, status === 'resolved' ? 'resolved' : 'reopened', 'event')
    }
    send(res, 200, { thread: await loadThread(thread.id) })
  },
})
