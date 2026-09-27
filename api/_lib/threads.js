import { one, query } from './db.js'
import { HttpError } from './http.js'
import { publicUser } from './session.js'

export async function usersById(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return {}
  const rows = await query('select * from users where id = any($1)', [unique])
  return Object.fromEntries(rows.map((u) => [u.id, publicUser(u)]))
}

export async function activeMemberIds() {
  const rows = await query('select id from users where active')
  return rows.map((r) => r.id)
}

export function reviewers(proposal, memberIds) {
  return memberIds.filter((id) => id !== proposal.author_id)
}

export function proposalView(p, users, approvals = [], memberIds = []) {
  if (!p) return null
  const open = ['pending', 'conflict', 'applying'].includes(p.status)
  const approvedIds = approvals.filter((a) => a.proposal_id === p.id).map((a) => a.user_id)
  const expected = reviewers(p, memberIds)
  return {
    id: p.id,
    thread_id: p.thread_id,
    path: p.path,
    action: p.action,
    title: p.title,
    base_sha: p.base_sha,
    base_content: p.base_content,
    content: p.content,
    status: p.status,
    error: p.error,
    commit_sha: p.commit_sha,
    created_at: p.created_at,
    updated_at: p.updated_at,
    decided_at: p.decided_at,
    author: users[p.author_id] ?? null,
    decided_by: users[p.decided_by] ?? null,
    approved_by: approvedIds.filter((id) => !open || expected.includes(id)).map((id) => users[id]).filter(Boolean),
    waiting_for: open ? expected.filter((id) => !approvedIds.includes(id)).map((id) => users[id]).filter(Boolean) : [],
  }
}

export async function loadThreads(where, params) {
  const threads = await query(`select * from threads where ${where} order by created_at`, params)
  if (!threads.length) return []
  const ids = threads.map((t) => t.id)
  const [messages, proposals] = await Promise.all([
    query('select * from messages where thread_id = any($1) order by created_at', [ids]),
    query('select * from proposals where thread_id = any($1)', [ids]),
  ])
  const [approvals, memberIds] = await Promise.all([
    proposals.length
      ? query('select * from approvals where proposal_id = any($1) order by created_at', [proposals.map((p) => p.id)])
      : [],
    proposals.length ? activeMemberIds() : [],
  ])
  const users = await usersById([
    ...threads.flatMap((t) => [t.created_by, t.resolved_by]),
    ...messages.map((m) => m.author_id),
    ...proposals.flatMap((p) => [p.author_id, p.decided_by]),
    ...approvals.map((a) => a.user_id),
    ...memberIds,
  ])
  return threads.map((t) => ({
    id: t.id,
    path: t.path,
    kind: t.kind,
    anchor: t.anchor,
    base_sha: t.base_sha,
    status: t.status,
    created_at: t.created_at,
    updated_at: t.updated_at,
    resolved_at: t.resolved_at,
    author: users[t.created_by] ?? null,
    resolved_by: users[t.resolved_by] ?? null,
    proposal: proposalView(proposals.find((p) => p.thread_id === t.id), users, approvals, memberIds),
    messages: messages
      .filter((m) => m.thread_id === t.id)
      .map((m) => ({ id: m.id, kind: m.kind, body: m.body, created_at: m.created_at, author: users[m.author_id] ?? null })),
  }))
}

export async function loadThread(id) {
  const [thread] = await loadThreads('id = $1', [id])
  if (!thread) throw new HttpError(404, 'thread_not_found', 'Thread not found')
  return thread
}

export async function createThread({ path, kind, anchor = null, baseSha = null, userId, body }) {
  const thread = await one(
    `insert into threads (path, kind, anchor, base_sha, created_by)
     values ($1, $2, $3, $4, $5) returning *`,
    [path, kind, anchor ? JSON.stringify(anchor) : null, baseSha, userId],
  )
  if (body?.trim()) await addMessage(thread.id, userId, body.trim())
  return thread
}

export async function addMessage(threadId, userId, body, kind = 'text') {
  await query('insert into messages (thread_id, author_id, kind, body) values ($1, $2, $3, $4)', [
    threadId,
    userId,
    kind,
    body,
  ])
  await query('update threads set updated_at = now() where id = $1', [threadId])
}

export async function setThreadStatus(threadId, status, userId) {
  await query(
    `update threads set status = $2, updated_at = now(),
       resolved_by = case when $2 = 'resolved' then $3::bigint end,
       resolved_at = case when $2 = 'resolved' then now() end
     where id = $1`,
    [threadId, status, userId],
  )
}
