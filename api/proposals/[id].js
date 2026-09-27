import { body, handler, param, send } from '../_lib/http.js'
import { getProposal, reviseProposal } from '../_lib/proposals.js'
import { loadThread } from '../_lib/threads.js'

async function view(id) {
  const proposal = await getProposal(id)
  return { thread: await loadThread(proposal.thread_id) }
}

export default handler({
  GET: async (req, res) => {
    send(res, 200, await view(param(req, 'id')))
  },
  PATCH: async (req, res) => {
    await reviseProposal(param(req, 'id'), req.user, await body(req))
    send(res, 200, await view(param(req, 'id')))
  },
})
