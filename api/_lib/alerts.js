import { query } from './db.js'
import { publicUser } from './session.js'

const OPEN = ['pending', 'conflict', 'applying']

export async function recordPassageChanged(thread) {
  const lost = await query(
    `select author_id, content from proposals where thread_id = $1 and status = any($2) order by created_at`,
    [thread.id, OPEN],
  )
  if (!lost.length) return
  await query(`insert into alerts (kind, path, thread_id, details) values ('passage_changed', $1, $2, $3)`, [
    thread.path,
    thread.id,
    JSON.stringify({ quote: thread.anchor.quote, proposals: lost }),
  ])
}

export async function recordFileDeleted(path, via) {
  const lost = await query(
    `select p.author_id, p.content, t.anchor->>'quote' as quote
       from proposals p join threads t on t.id = p.thread_id
      where p.path = $1 and p.action = 'replace' and p.status = any($2)
      order by p.created_at`,
    [path, OPEN],
  )
  if (!lost.length) return
  await query(`insert into alerts (kind, path, details) values ('file_deleted', $1, $2)`, [
    path,
    JSON.stringify({ via, proposals: lost }),
  ])
}

export async function listAlerts(userId) {
  const alerts = await query(
    `select * from alerts a
      where not exists (select 1 from alert_views v where v.alert_id = a.id and v.user_id = $1)
      order by created_at desc`,
    [userId],
  )
  const ids = [...new Set(alerts.flatMap((a) => a.details.proposals.map((p) => p.author_id)))]
  const users = ids.length ? await query('select * from users where id = any($1)', [ids]) : []
  const byId = Object.fromEntries(users.map((u) => [u.id, publicUser(u)]))
  return alerts.map((a) => ({
    id: a.id,
    kind: a.kind,
    path: a.path,
    thread_id: a.thread_id,
    created_at: a.created_at,
    via: a.details.via ?? null,
    quote: a.details.quote ?? null,
    proposals: a.details.proposals.map((p) => ({
      author: byId[p.author_id] ?? null,
      quote: p.quote ?? a.details.quote ?? '',
      content: p.content,
    })),
  }))
}

export async function cleanupAlerts() {
  await query(
    `delete from alerts a where not exists (
       select 1 from users u where u.active
          and not exists (select 1 from alert_views v where v.alert_id = a.id and v.user_id = u.id)
     )`,
  )
}

export async function dismissAlert(id, userId) {
  await query('insert into alert_views (alert_id, user_id) values ($1, $2) on conflict do nothing', [id, userId])
  await cleanupAlerts()
}
