import { one, query } from './db.js'
import { HttpError } from './http.js'
import { GithubError } from './github.js'
import { deleteFile, readFile, repoContext, writeFile } from './repo.js'
import { activeMemberIds, addMessage, reviewers, setThreadStatus } from './threads.js'
import { replaceAt } from '../../shared/anchor.js'
import { hasConflictMarkers, mergeText } from '../../shared/merge.js'

const APP_NAME = 'Zigda'

class Conflict extends Error {}

export async function getProposal(id) {
  const proposal = await one('select * from proposals where id = $1', [id])
  if (!proposal) throw new HttpError(404, 'proposal_not_found', 'Proposal not found')
  return proposal
}

export function checkContent(content) {
  if (typeof content !== 'string') throw new HttpError(400, 'content_required', 'Content is required')
  if (hasConflictMarkers(content)) throw new HttpError(400, 'conflict_markers', 'Content still has conflict markers')
}

function commitAuthor(user) {
  return { name: user.name || user.login, email: `${user.id}+${user.login}@users.noreply.github.com` }
}

function commitMessage(proposal, author, approvers) {
  const verbs = { edit: 'Update', create: 'Create', delete: 'Delete', replace: 'Update' }
  const title = proposal.title?.trim() || `${verbs[proposal.action]} ${proposal.path}`
  const names = approvers.map((u) => `@${u.login}`).join(', ')
  return `${title}\n\nProposed by @${author.login}, approved by ${names} via ${APP_NAME}.`
}

async function nextContent(ctx, proposal, anchor) {
  const current = await readFile(ctx, proposal.path)
  if (proposal.action === 'create') {
    if (current) throw new Conflict('file_exists')
    return { current, text: proposal.content }
  }
  if (!current) throw new Conflict('file_missing')
  if (current.binary) throw new Conflict('file_binary')
  if (proposal.action === 'delete') {
    if (current.sha !== proposal.base_sha) throw new Conflict('file_changed')
    return { current, text: null }
  }
  if (proposal.action === 'replace') {
    const text = replaceAt(current.content, anchor, proposal.content)
    if (text === null) throw new Conflict('passage_missing')
    return { current, text }
  }
  if (current.sha === proposal.base_sha) return { current, text: proposal.content }
  const merged = mergeText(proposal.base_content, current.content, proposal.content)
  if (!merged.ok) throw new Conflict('merge_conflict')
  return { current, text: merged.text }
}

async function isComplete(proposal) {
  const expected = reviewers(proposal, await activeMemberIds())
  if (!expected.length) return false
  const rows = await query('select user_id from approvals where proposal_id = $1', [proposal.id])
  const approved = new Set(rows.map((r) => r.user_id))
  return expected.every((id) => approved.has(id))
}

export async function approveProposal(id, user) {
  const proposal = await getProposal(id)
  if (proposal.author_id === user.id) throw new HttpError(403, 'own_proposal', 'You cannot approve your own proposal')
  if (proposal.status !== 'pending') throw new HttpError(409, 'proposal_not_pending', 'This proposal is no longer pending')
  const inserted = await query(
    `insert into approvals (proposal_id, user_id) values ($1, $2) on conflict do nothing returning user_id`,
    [id, user.id],
  )
  if (await isComplete(proposal)) return applyProposal(id, user, 'applied')
  if (inserted.length) await addMessage(proposal.thread_id, user.id, 'approved', 'event')
}

export async function applyCompletedProposals(actor) {
  const pending = await query(`select * from proposals where status = 'pending'`)
  for (const proposal of pending) {
    if (!(await isComplete(proposal))) continue
    try {
      await applyProposal(proposal.id, actor, 'applied:auto')
    } catch (err) {
      console.warn('[proposals] automatic apply failed', proposal.id, err.message)
    }
  }
}

async function applyProposal(id, actor, event) {
  const proposal = await one(
    `update proposals set status = 'applying', updated_at = now() where id = $1 and status = 'pending' returning *`,
    [id],
  )
  if (!proposal) return

  const thread = await one('select * from threads where id = $1', [proposal.thread_id])
  const author = await one('select * from users where id = $1', [proposal.author_id])
  const approvers = await query(
    `select u.* from approvals a join users u on u.id = a.user_id where a.proposal_id = $1 order by a.created_at`,
    [id],
  )
  const message = commitMessage(proposal, author, approvers)

  try {
    const ctx = await repoContext()
    let commitSha
    for (let attempt = 0; ; attempt++) {
      const { current, text } = await nextContent(ctx, proposal, thread.anchor)
      try {
        commitSha =
          text === null
            ? await deleteFile(ctx, proposal.path, { sha: current.sha, message, author: commitAuthor(author) })
            : await writeFile(ctx, proposal.path, {
                content: text,
                sha: current?.sha,
                message,
                author: commitAuthor(author),
              })
        break
      } catch (err) {
        if (!(err instanceof GithubError && err.code === 'github_conflict') || attempt >= 2) throw err
      }
    }
    await query(
      `update proposals set status = 'applied', error = null, commit_sha = $2, decided_by = $3,
         decided_at = now(), updated_at = now() where id = $1`,
      [id, commitSha, actor.id],
    )
    await addMessage(proposal.thread_id, actor.id, event, 'event')
    await setThreadStatus(proposal.thread_id, 'resolved', actor.id)
  } catch (err) {
    if (err instanceof Conflict) {
      await query(`update proposals set status = 'conflict', error = $2, updated_at = now() where id = $1`, [
        id,
        err.message,
      ])
      await addMessage(proposal.thread_id, actor.id, `conflict:${err.message}`, 'event')
      throw new HttpError(409, 'proposal_conflict', err.message)
    }
    await query(`update proposals set status = 'pending', updated_at = now() where id = $1`, [id])
    throw err
  }
}

export async function closeProposal(id, user, status) {
  const proposal = await getProposal(id)
  const own = proposal.author_id === user.id
  if (status === 'withdrawn' && !own) throw new HttpError(403, 'not_author', 'Only the author can withdraw')
  if (status === 'rejected' && own) throw new HttpError(403, 'own_proposal', 'Withdraw your own proposal instead')
  const updated = await one(
    `update proposals set status = $2, decided_by = $3, decided_at = now(), updated_at = now()
     where id = $1 and status in ('pending', 'conflict') returning *`,
    [id, status, user.id],
  )
  if (!updated) throw new HttpError(409, 'proposal_not_pending', 'This proposal is no longer pending')
  await addMessage(proposal.thread_id, user.id, status, 'event')
  await setThreadStatus(proposal.thread_id, 'resolved', user.id)
}

export async function reviseProposal(id, user, { content, baseSha, title }) {
  const proposal = await getProposal(id)
  if (proposal.author_id !== user.id) throw new HttpError(403, 'not_author', 'Only the author can edit')
  if (!['pending', 'conflict'].includes(proposal.status)) {
    throw new HttpError(409, 'proposal_not_pending', 'This proposal is no longer pending')
  }
  if (proposal.action === 'delete') throw new HttpError(400, 'not_editable', 'A deletion cannot be edited')

  let baseContent = proposal.base_content
  let sha = proposal.base_sha
  if (proposal.action === 'edit') {
    checkContent(content)
    const ctx = await repoContext()
    const current = await readFile(ctx, proposal.path)
    if (!current || current.binary) throw new HttpError(409, 'file_missing', 'The file no longer exists')
    if (current.sha !== baseSha) throw new HttpError(409, 'file_changed', 'The file changed meanwhile, reload it')
    baseContent = current.content
    sha = current.sha
  } else if (typeof content !== 'string') {
    throw new HttpError(400, 'content_required', 'Content is required')
  }

  await query(
    `update proposals set content = $2, base_content = $3, base_sha = $4, title = coalesce($5, title),
       status = 'pending', error = null, updated_at = now() where id = $1`,
    [id, content, baseContent, sha, title?.trim() || null],
  )
  const reset = await query('delete from approvals where proposal_id = $1 returning user_id', [id])
  await addMessage(proposal.thread_id, user.id, reset.length ? 'updated:reset' : 'updated', 'event')
}
