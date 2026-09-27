import { handler, send } from '../_lib/http.js'
import { closeSession } from '../_lib/session.js'

export default handler(
  {
    POST: async (req, res) => {
      closeSession(res, req)
      send(res, 200, { ok: true })
    },
  },
  { auth: 'none' },
)
