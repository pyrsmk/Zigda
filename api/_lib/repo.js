import { one, query } from './db.js'
import { decrypt, encrypt } from './crypto.js'
import { gh, GithubError } from './github.js'
import { HttpError } from './http.js'

export async function settings() {
  return one('select * from settings where id')
}

export async function rootToken() {
  const row = await settings()
  if (!row?.github_token) throw new HttpError(409, 'github_token_missing', 'The app owner must reconnect GitHub')
  return decrypt(row.github_token)
}

export async function saveRootToken(token) {
  await query(
    `insert into settings (id, github_token) values (true, $1)
     on conflict (id) do update set github_token = excluded.github_token, updated_at = now()`,
    [encrypt(token)],
  )
}

export async function saveRepo(owner, name, branch) {
  await query(
    `insert into settings (id, repo_owner, repo_name, branch) values (true, $1, $2, $3)
     on conflict (id) do update set repo_owner = $1, repo_name = $2, branch = $3, updated_at = now()`,
    [owner, name, branch],
  )
}

export function splitRepo(fullName) {
  const [owner, name, extra] = (fullName ?? '').split('/')
  if (!owner || !name || extra !== undefined) throw new HttpError(400, 'invalid_repo', 'Expected owner/name')
  return { owner, name }
}

export async function repoContext() {
  const row = await settings()
  if (!row?.repo_name) throw new HttpError(409, 'repo_not_configured', 'No repository selected yet')
  return {
    token: await rootToken(),
    owner: row.repo_owner,
    repo: row.repo_name,
    branch: row.branch,
    base: `/repos/${encodeURIComponent(row.repo_owner)}/${encodeURIComponent(row.repo_name)}`,
  }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0)
}

export async function tree(ctx) {
  const data = await gh(ctx.token, `${ctx.base}/git/trees/${encodeURIComponent(ctx.branch)}?recursive=1`)
  return {
    truncated: data.truncated,
    entries: data.tree
      .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
      .map((entry) => ({ path: entry.path, type: entry.type, size: entry.size ?? null })),
  }
}

export async function readBlob(ctx, sha) {
  const data = await gh(ctx.token, `${ctx.base}/git/blobs/${sha}`)
  return Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8')
}

export async function readFile(ctx, path) {
  let data
  try {
    data = await gh(ctx.token, `${ctx.base}/contents/${encodePath(path)}?ref=${encodeURIComponent(ctx.branch)}`)
  } catch (err) {
    if (err instanceof GithubError && err.code === 'github_not_found') return null
    throw err
  }
  if (Array.isArray(data) || data.type !== 'file') throw new HttpError(400, 'not_a_file', 'This path is not a file')
  const buffer = data.encoding === 'base64' ? Buffer.from(data.content, 'base64') : await readBlob(ctx, data.sha)
  const binary = isBinary(buffer)
  return { path, sha: data.sha, size: data.size, binary, content: binary ? null : buffer.toString('utf8') }
}

export async function readText(ctx, sha) {
  const buffer = await readBlob(ctx, sha)
  return isBinary(buffer) ? null : buffer.toString('utf8')
}

export async function rawFile(ctx, path) {
  return gh(ctx.token, `${ctx.base}/contents/${encodePath(path)}?ref=${encodeURIComponent(ctx.branch)}`, {
    accept: 'application/vnd.github.raw+json',
    raw: true,
  })
}

export async function writeFile(ctx, path, { content, sha, message, author }) {
  const data = await gh(ctx.token, `${ctx.base}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: ctx.branch,
      author,
      ...(sha ? { sha } : null),
    },
  })
  return { commitSha: data.commit.sha, sha: data.content.sha }
}

export async function deleteFile(ctx, path, { sha, message, author }) {
  const data = await gh(ctx.token, `${ctx.base}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    body: { message, sha, branch: ctx.branch, author },
  })
  return data.commit.sha
}

export async function history(ctx, path) {
  const params = new URLSearchParams({ sha: ctx.branch, path, per_page: '30' })
  const commits = await gh(ctx.token, `${ctx.base}/commits?${params}`)
  return commits.map(summarizeCommit)
}

export async function commit(ctx, sha, path) {
  const data = await gh(ctx.token, `${ctx.base}/commits/${sha}`)
  const file = data.files?.find((f) => f.filename === path || f.previous_filename === path)
  return { ...summarizeCommit(data), patch: file?.patch ?? null, status: file?.status ?? null }
}

function summarizeCommit(c) {
  return {
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.author?.date,
    author: {
      name: c.commit.author?.name,
      login: c.author?.login ?? null,
      avatar_url: c.author?.avatar_url ?? null,
    },
  }
}
