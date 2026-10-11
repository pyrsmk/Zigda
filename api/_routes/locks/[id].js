import { handler, param, send } from '../../_lib/http.js'
import { releaseLock, renewLock } from '../../_lib/locks.js'

export default handler({
  PATCH: async (req, res) => {
    await renewLock(param(req, 'id'), req.user.id)
    send(res, 200, {})
  },
  DELETE: async (req, res) => {
    await releaseLock(param(req, 'id'), req.user.id)
    send(res, 200, {})
  },
})
