import { body, handler, HttpError, param, send } from '../../_lib/http.js'
import { one } from '../../_lib/db.js'
import { readFile, readText, repoContext } from '../../_lib/repo.js'
import { createThread, loadThreads } from '../../_lib/threads.js'
import { checkContent } from '../../_lib/proposals.js'

const OPEN = `('pending', 'applying', 'conflict')`

function checkPath(path) {
  const parts = String(path ?? '').split('/')
  if (!path || parts.some((p) => !p || p === '.' || p === '..')) {
    throw new HttpError(400, 'invalid_path', 'Invalid file path')
  }
  return parts.join('/')
}

export default handler({
  GET: async (req, res) => {
    const closed = param(req, 'status') === 'closed'
    const path = param(req, 'path')
    const filters = [`status ${closed ? 'not in' : 'in'} ${OPEN}`]
    const params = []
    if (path) {
      params.push(path)
      filters.push(`path = $1`)
    }
    const threads = await loadThreads(
      `id in (select thread_id from proposals where ${filters.join(' and ')} order by updated_at desc limit 50)`,
      params,
    )
    threads.sort((a, b) => new Date(b.proposal.updated_at) - new Date(a.proposal.updated_at))
    send(res, 200, { threads })
  },
  POST: async (req, res) => {
    const input = await body(req)
    const path = checkPath(input.path)
    const ctx = await repoContext()
    let baseSha = null
    let baseContent = null
    let content = null

    if (input.action === 'create') {
      checkContent(input.content)
      if (await readFile(ctx, path)) throw new HttpError(409, 'file_exists', 'This file already exists')
      content = input.content
    } else if (input.action === 'edit') {
      checkContent(input.content)
      if (!input.baseSha) throw new HttpError(400, 'sha_required', 'The edited version is required')
      baseContent = await readText(ctx, input.baseSha)
      if (baseContent === null) throw new HttpError(400, 'file_binary', 'Binary files cannot be edited')
      if (baseContent === input.content) throw new HttpError(400, 'no_change', 'Nothing changed')
      baseSha = input.baseSha
      content = input.content
    } else if (input.action === 'delete') {
      const current = await readFile(ctx, path)
      if (!current) throw new HttpError(404, 'file_not_found', 'File not found')
      baseSha = current.sha
      baseContent = current.content
    } else {
      throw new HttpError(400, 'invalid_action', 'Unknown action')
    }

    const thread = await createThread({ path, kind: 'proposal', baseSha, userId: req.user.id, body: input.body })
    const proposal = await one(
      `insert into proposals (thread_id, path, action, title, base_sha, base_content, content, author_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [thread.id, path, input.action, input.title?.trim() || null, baseSha, baseContent, content, req.user.id],
    )
    send(res, 201, { id: proposal.id })
  },
})
