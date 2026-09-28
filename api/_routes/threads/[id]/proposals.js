import { body, handler, param, send } from '../../../_lib/http.js'
import { addVersion } from '../../../_lib/proposals.js'
import { loadThread } from '../../../_lib/threads.js'

export default handler({
  POST: async (req, res) => {
    await addVersion(param(req, 'id'), req.user, await body(req))
    send(res, 201, { thread: await loadThread(param(req, 'id')) })
  },
})
