import { handler, param, send } from '../../../_lib/http.js'
import { closeProposal, getProposal } from '../../../_lib/proposals.js'
import { loadThread } from '../../../_lib/threads.js'

export default handler({
  POST: async (req, res) => {
    await closeProposal(param(req, 'id'), req.user, 'withdrawn')
    const proposal = await getProposal(param(req, 'id'))
    send(res, 200, { thread: await loadThread(proposal.thread_id) })
  },
})
