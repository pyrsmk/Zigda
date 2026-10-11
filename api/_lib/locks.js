import { one, query } from './db.js'
import { HttpError } from './http.js'
import { readFile, repoContext } from './repo.js'
import { locate, overlaps } from '../../shared/anchor.js'

const TTL = "interval '2 minutes'"

async function holders(path, text, place, exceptId = null) {
  const locks = await query(
    `select l.id, l.anchor, u.id as user_id, u.login, u.name, u.avatar_url
       from edit_locks l join users u on u.id = l.user_id
      where l.path = $1 and l.expires_at > now() and l.id is distinct from $2
      order by l.created_at, l.id`,
    [path, exceptId],
  )
  return locks.filter((lock) => {
    const range = locate(text, lock.anchor)
    return range && overlaps(range, place)
  })
}

function locked(lock) {
  return new HttpError(409, 'passage_locked', 'Someone is already editing this passage', {
    holder: { id: lock.user_id, login: lock.login, name: lock.name, avatar_url: lock.avatar_url },
  })
}

export async function checkUnlocked(path, text, place, exceptId = null) {
  const [lock] = await holders(path, text, place, exceptId)
  if (lock) throw locked(lock)
}

export async function checkThreadUnlocked(threadId) {
  const thread = await one('select path, anchor from threads where id = $1', [threadId])
  if (!thread?.anchor) return
  const current = await readFile(await repoContext(), thread.path)
  const place = current && !current.binary ? locate(current.content, thread.anchor) : null
  if (place) await checkUnlocked(thread.path, current.content, place)
}

export async function checkFileUnlocked(path) {
  const lock = await one(
    `select l.id, u.id as user_id, u.login, u.name, u.avatar_url
       from edit_locks l join users u on u.id = l.user_id
      where l.path = $1 and l.expires_at > now() limit 1`,
    [path],
  )
  if (lock) throw locked(lock)
}

export async function acquireLock(path, text, place, anchor, userId) {
  await query('delete from edit_locks where expires_at < now()')
  await checkUnlocked(path, text, place)
  const lock = await one(
    `insert into edit_locks (path, anchor, user_id, expires_at) values ($1, $2, $3, now() + ${TTL}) returning id`,
    [path, JSON.stringify(anchor), userId],
  )
  const [first] = await holders(path, text, place)
  if (first.id !== lock.id) {
    await releaseLock(lock.id, userId)
    throw locked(first)
  }
  return lock
}

export async function holdsLock(id, userId) {
  return Boolean(
    await one('select id from edit_locks where id = $1 and user_id = $2 and expires_at > now()', [id, userId]),
  )
}

export async function renewLock(id, userId) {
  await query(
    `update edit_locks set expires_at = now() + ${TTL} where id = $1 and user_id = $2 and expires_at > now()`,
    [id, userId],
  )
}

export async function releaseLock(id, userId) {
  await query('delete from edit_locks where id = $1 and user_id = $2', [id, userId])
}
