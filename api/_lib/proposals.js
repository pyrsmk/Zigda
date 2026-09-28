import { one, query } from './db.js'
import { HttpError } from './http.js'
import { GithubError } from './github.js'
import { deleteFile, readFile, repoContext, writeFile } from './repo.js'
import {
  activeMemberIds,
  addMessage,
  closeVanished,
  olderDiscussions,
  purgePath,
  reviewers,
  setThreadStatus,
} from './threads.js'
import { locate, makeAnchor } from '../../shared/anchor.js'

const APP_NAME = 'Zigda'
const OPEN = ['pending', 'conflict']

class Conflict extends Error {}

export async function getProposal(id) {
  const proposal = await one('select * from proposals where id = $1', [id])
  if (!proposal) throw new HttpError(404, 'proposal_not_found', 'Proposal not found')
  return proposal
}

export function checkContent(content) {
  if (typeof content !== 'string') throw new HttpError(400, 'content_required', 'Content is required')
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

async function isComplete(proposal) {
  const expected = reviewers(proposal, await activeMemberIds())
  if (!expected.length) return false
  const rows = await query('select user_id from approvals where proposal_id = $1', [proposal.id])
  const approved = new Set(rows.map((r) => r.user_id))
  return expected.every((id) => approved.has(id))
}

async function isBlocked(proposal) {
  return proposal.action === 'delete' && (await olderDiscussions(proposal)) > 0
}

export async function approveProposal(id, user) {
  const proposal = await getProposal(id)
  if (proposal.author_id === user.id) throw new HttpError(403, 'own_proposal', 'You cannot approve your own proposal')
  if (proposal.status !== 'pending') throw new HttpError(409, 'proposal_not_pending', 'This proposal is no longer pending')
  if (await isBlocked(proposal)) {
    throw new HttpError(409, 'deletion_blocked', 'Older discussions on this file must be settled first')
  }
  const inserted = await query(
    `insert into approvals (proposal_id, user_id) values ($1, $2) on conflict do nothing returning user_id`,
    [id, user.id],
  )
  if (await isComplete(proposal)) return applyProposal(id, user, 'applied')
  if (inserted.length) await addMessage(proposal.thread_id, user.id, `approved@${id}`, 'event')
}

export async function applyCompletedProposals(actor) {
  const pending = await query(
    `select * from proposals where status = 'pending' order by action = 'delete', created_at`,
  )
  for (const proposal of pending) {
    if (!(await isComplete(proposal)) || (await isBlocked(proposal))) continue
    try {
      await applyProposal(proposal.id, actor, 'applied:auto')
    } catch (err) {
      console.warn('[proposals] automatic apply failed', proposal.id, err.message)
    }
  }
}

async function commitChange(ctx, proposal, thread, message, author) {
  const current = await readFile(ctx, proposal.path)
  if (proposal.action === 'create') {
    if (current) throw new Conflict('file_exists')
    const { commitSha } = await writeFile(ctx, proposal.path, {
      content: proposal.content,
      message,
      author: commitAuthor(author),
    })
    return { commitSha }
  }
  if (!current) throw new Conflict('file_missing')
  if (proposal.action === 'delete') {
    return { commitSha: await deleteFile(ctx, proposal.path, { sha: current.sha, message, author: commitAuthor(author) }) }
  }
  if (current.binary) throw new Conflict('file_binary')
  const place = locate(current.content, thread.anchor)
  if (!place) throw new Conflict('passage_missing')
  const text = current.content.slice(0, place.start) + proposal.content + current.content.slice(place.end)
  const { commitSha, sha } = await writeFile(ctx, proposal.path, {
    content: text,
    sha: current.sha,
    message,
    author: commitAuthor(author),
  })
  return { commitSha, edit: { before: current.content, after: text, place, sha } }
}

async function rebaseAnchors(path, appliedThreadId, { before, after, place, sha }) {
  const others = await query(
    `select * from threads where path = $1 and kind = 'passage' and status = 'open' and id <> $2`,
    [path, appliedThreadId],
  )
  const delta = after.length - before.length
  for (const thread of others) {
    const range = locate(before, thread.anchor)
    if (!range) continue
    let { start, end } = range
    if (start >= place.end) {
      start += delta
      end += delta
    } else if (end > place.start) {
      continue
    }
    await query('update threads set anchor = $2, base_sha = $3 where id = $1', [
      thread.id,
      JSON.stringify(makeAnchor(after, start, end)),
      sha,
    ])
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
    let result
    for (let attempt = 0; ; attempt++) {
      try {
        result = await commitChange(ctx, proposal, thread, message, author)
        break
      } catch (err) {
        if (!(err instanceof GithubError && err.code === 'github_conflict') || attempt >= 2) throw err
      }
    }
    await query(
      `update proposals set status = 'applied', error = null, commit_sha = $2, decided_by = $3,
         decided_at = now(), updated_at = now() where id = $1`,
      [id, result.commitSha, actor.id],
    )
    await addMessage(thread.id, actor.id, `${event}@${id}`, 'event')
    if (proposal.action === 'replace') {
      await query(
        `update proposals set status = 'discarded', error = 'other_version', updated_at = now()
          where thread_id = $1 and id <> $2 and status in ('pending', 'conflict')`,
        [thread.id, id],
      )
      await rebaseAnchors(proposal.path, thread.id, result.edit)
    }
    await setThreadStatus(thread.id, 'resolved', actor.id)
    if (proposal.action === 'delete') await purgePath(proposal.path)
  } catch (err) {
    if (err instanceof Conflict) {
      if (err.message === 'file_missing') {
        await purgePath(proposal.path)
      } else if (err.message === 'passage_missing') {
        await closeVanished(thread, actor.id)
      } else {
        await query(`update proposals set status = 'conflict', error = $2, updated_at = now() where id = $1`, [
          id,
          err.message,
        ])
        await addMessage(thread.id, actor.id, `conflict:${err.message}`, 'event')
      }
      throw new HttpError(409, err.message, err.message)
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
  await addMessage(proposal.thread_id, user.id, `${status}@${id}`, 'event')
  if (proposal.action !== 'replace') await setThreadStatus(proposal.thread_id, 'resolved', user.id)
}

async function openPassage(threadId) {
  const thread = await one('select * from threads where id = $1', [threadId])
  if (!thread || thread.kind !== 'passage') throw new HttpError(404, 'thread_not_found', 'Discussion not found')
  if (thread.status !== 'open') throw new HttpError(409, 'thread_closed', 'This discussion is closed')
  return thread
}

function checkReplacement(thread, content) {
  checkContent(content)
  if (content === thread.anchor.quote) throw new HttpError(400, 'replacement_required', 'The version must change the text')
}

export async function addVersion(threadId, user, { content, body }, { announce = true } = {}) {
  const thread = await openPassage(threadId)
  checkReplacement(thread, content)
  const existing = await one(
    `select id from proposals where thread_id = $1 and author_id = $2 and status = any($3)`,
    [thread.id, user.id, OPEN],
  )
  if (existing) throw new HttpError(409, 'version_exists', 'You already have a version in this discussion')
  const proposal = await one(
    `insert into proposals (thread_id, path, action, base_sha, base_content, content, author_id)
     values ($1, $2, 'replace', $3, $4, $5, $6) returning id`,
    [thread.id, thread.path, thread.base_sha, thread.anchor.quote, content, user.id],
  )
  if (announce) await addMessage(thread.id, user.id, `proposed@${proposal.id}`, 'event')
  if (body?.trim()) await addMessage(thread.id, user.id, body.trim())
  return proposal
}

export async function reviseProposal(id, user, { content, title }) {
  const proposal = await getProposal(id)
  if (proposal.author_id !== user.id) throw new HttpError(403, 'not_author', 'Only the author can edit')
  if (!OPEN.includes(proposal.status)) {
    throw new HttpError(409, 'proposal_not_pending', 'This proposal is no longer pending')
  }
  if (proposal.action === 'delete') throw new HttpError(400, 'not_editable', 'A deletion cannot be edited')
  if (proposal.action === 'replace') checkReplacement(await openPassage(proposal.thread_id), content)
  else checkContent(content)

  await query(
    `update proposals set content = $2, title = coalesce($3, title), status = 'pending', error = null,
       updated_at = now() where id = $1`,
    [id, content, title?.trim() || null],
  )
  const reset = await query('delete from approvals where proposal_id = $1 returning user_id', [id])
  await addMessage(proposal.thread_id, user.id, `${reset.length ? 'updated:reset' : 'updated'}@${id}`, 'event')
}

export async function cancelAuthorProposals(userId, actor) {
  const cancelled = await query(
    `update proposals set status = 'discarded', error = 'author_removed', decided_by = $2, decided_at = now(),
       updated_at = now() where author_id = $1 and status = any($3) returning *`,
    [userId, actor.id, OPEN],
  )
  for (const proposal of cancelled) {
    await addMessage(proposal.thread_id, actor.id, `author_removed@${proposal.id}`, 'event')
    const thread = await one('select * from threads where id = $1', [proposal.thread_id])
    const remaining = await one(
      `select count(*)::int as count from proposals where thread_id = $1 and status = any($2)`,
      [thread.id, OPEN],
    )
    const orphaned = thread.kind === 'proposal' || (thread.created_by === userId && !remaining.count)
    if (orphaned && thread.status === 'open') await setThreadStatus(thread.id, 'resolved', actor.id)
  }
}
