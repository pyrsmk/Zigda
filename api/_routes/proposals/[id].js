import { body, handler, param, send } from '../../_lib/http.js'
import { getProposal, reviseProposal } from '../../_lib/proposals.js'
import { loadThread } from '../../_lib/threads.js'
import { checkThreadUnlocked } from '../../_lib/locks.js'

async function view(id) {
  const proposal = await getProposal(id)
  return { thread: await loadThread(proposal.thread_id) }
}

export default handler({
  GET: async (req, res) => {
    send(res, 200, await view(param(req, 'id')))
  },
  PATCH: async (req, res) => {
    const proposal = await getProposal(param(req, 'id'))
    if (proposal.action === 'replace') await checkThreadUnlocked(proposal.thread_id)
    await reviseProposal(proposal.id, req.user, await body(req))
    send(res, 200, await view(param(req, 'id')))
  },
})
