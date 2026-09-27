import { body, handler, HttpError, param, send } from '../../_lib/http.js'
import { addMessage, loadThread } from '../../_lib/threads.js'

export default handler({
  POST: async (req, res) => {
    const thread = await loadThread(param(req, 'id'))
    const text = String((await body(req)).body ?? '').trim()
    if (!text) throw new HttpError(400, 'body_required', 'A message is required')
    await addMessage(thread.id, req.user.id, text)
    send(res, 201, { thread: await loadThread(thread.id) })
  },
})
