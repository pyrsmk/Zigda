import { send } from './_lib/http.js'
import activity from './_routes/activity.js'
import authCallback from './_routes/auth/callback.js'
import authLogin from './_routes/auth/login.js'
import authLogout from './_routes/auth/logout.js'
import file from './_routes/file.js'
import history from './_routes/history.js'
import me from './_routes/me.js'
import member from './_routes/members/[login].js'
import members from './_routes/members/index.js'
import overview from './_routes/overview.js'
import proposal from './_routes/proposals/[id].js'
import proposalApprove from './_routes/proposals/[id]/approve.js'
import proposalReject from './_routes/proposals/[id]/reject.js'
import proposalWithdraw from './_routes/proposals/[id]/withdraw.js'
import proposals from './_routes/proposals/index.js'
import raw from './_routes/raw.js'
import setupBranches from './_routes/setup/branches.js'
import setup from './_routes/setup/index.js'
import setupRepos from './_routes/setup/repos.js'
import thread from './_routes/threads/[id].js'
import threadMessages from './_routes/threads/[id]/messages.js'
import threadProposals from './_routes/threads/[id]/proposals.js'
import threads from './_routes/threads/index.js'
import tree from './_routes/tree.js'

const routes = [
  ['activity', activity],
  ['auth/callback', authCallback],
  ['auth/login', authLogin],
  ['auth/logout', authLogout],
  ['file', file],
  ['history', history],
  ['me', me],
  ['members', members],
  ['members/:login', member],
  ['overview', overview],
  ['proposals', proposals],
  ['proposals/:id', proposal],
  ['proposals/:id/approve', proposalApprove],
  ['proposals/:id/reject', proposalReject],
  ['proposals/:id/withdraw', proposalWithdraw],
  ['raw', raw],
  ['setup', setup],
  ['setup/branches', setupBranches],
  ['setup/repos', setupRepos],
  ['threads', threads],
  ['threads/:id', thread],
  ['threads/:id/messages', threadMessages],
  ['threads/:id/proposals', threadProposals],
  ['tree', tree],
].map(([pattern, handle]) => ({ segments: pattern.split('/'), handle }))

function match(path) {
  const parts = path.split('/').filter(Boolean)
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue
    const params = {}
    const ok = route.segments.every((seg, i) =>
      seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i],
    )
    if (ok) return { handle: route.handle, params }
  }
  return null
}

export default async function api(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const { __route, ...query } = { ...Object.fromEntries(url.searchParams), ...req.query }
  const path = __route ?? url.pathname.replace(/^\/api/, '')
  const found = match(path)
  if (!found) return send(res, 404, { code: 'not_found', error: `No route for /api/${path.replace(/^\//, '')}` })
  req.query = { ...query, ...found.params }
  await found.handle(req, res)
}
