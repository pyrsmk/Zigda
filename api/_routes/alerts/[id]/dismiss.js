import { handler, param, send } from '../../../_lib/http.js'
import { dismissAlert } from '../../../_lib/alerts.js'

export default handler({
  POST: async (req, res) => {
    await dismissAlert(param(req, 'id'), req.user.id)
    send(res, 200, { ok: true })
  },
})
