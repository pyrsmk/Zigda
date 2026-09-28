const MESSAGES = {
  unauthenticated: 'Your session has expired, please sign in again.',
  forbidden: 'Only the owner of the space can do this.',
  repo_not_configured: 'No repository has been chosen yet.',
  github_token_missing: 'The owner needs to reconnect their GitHub account.',
  github_token_invalid: 'GitHub access has expired: the owner needs to reconnect their account.',
  github_rate_limited: 'GitHub is asking us to slow down, try again in a few minutes.',
  github_not_found: 'Not found on GitHub.',
  github_error: 'GitHub returned an error.',
  github_user_not_found: 'No GitHub account has this name.',
  already_member: 'This person is already on the team.',
  invalid_login: 'This GitHub username is not valid.',
  cannot_remove_owner: 'The owner cannot be removed.',
  file_not_found: 'This file no longer exists.',
  file_exists: 'A file with this name already exists.',
  file_missing: 'The file no longer exists.',
  file_binary: 'This file cannot be edited here.',
  invalid_path: 'This file path is not valid.',
  own_proposal: 'You cannot approve your own proposal.',
  not_author: 'Only the author of the proposal can do this.',
  proposal_not_pending: 'This proposal has already been handled.',
  body_required: 'Write a message or propose a modification.',
  replacement_required: 'The version must change the text.',
  invalid_anchor: 'Select a passage of the text.',
  passage_missing: 'This passage has been changed in the repository in the meantime.',
  passage_taken: 'This passage is already under discussion.',
  version_exists: 'You already have a version in this discussion: edit it instead.',
  versions_pending: 'Some versions are still waiting for a decision.',
  thread_closed: 'This discussion is closed.',
  thread_applied: 'A version of this passage has already been applied.',
  deletion_blocked: 'Older discussions on this file must be settled first.',
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.code, MESSAGES[data.code] ?? `The server responded with ${res.status}.`)
  }
  return data
}

const q = (path) => encodeURIComponent(path)

export const api = {
  me: () => request('/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  repos: () => request('/setup/repos').then((d) => d.repos),
  branches: (repo) => request(`/setup/branches?repo=${q(repo)}`),
  saveRepo: (repo, branch) => request('/setup', { method: 'POST', body: { repo, branch } }),

  members: () => request('/members'),
  invite: (login) => request('/members', { method: 'POST', body: { login } }),
  removeMember: (login) => request(`/members/${q(login)}`, { method: 'DELETE' }),

  tree: () => request('/tree'),
  file: (path) => request(`/file?path=${q(path)}`),
  history: (path) => request(`/history?path=${q(path)}`).then((d) => d.commits),
  commit: (path, sha) => request(`/history?path=${q(path)}&sha=${sha}`).then((d) => d.commit),
  overview: () => request('/overview'),
  activity: () => request('/activity').then((d) => d.threads),

  threads: (path) => request(`/threads?path=${q(path)}`).then((d) => d.threads),
  createThread: (input) => request('/threads', { method: 'POST', body: input }).then((d) => d.thread),
  addVersion: (id, input) =>
    request(`/threads/${id}/proposals`, { method: 'POST', body: input }).then((d) => d.thread),
  reply: (id, body) => request(`/threads/${id}/messages`, { method: 'POST', body: { body } }).then((d) => d.thread),
  setThreadStatus: (id, status) =>
    request(`/threads/${id}`, { method: 'PATCH', body: { status } }).then((d) => d.thread),

  proposals: ({ closed = false, path } = {}) =>
    request(`/proposals?status=${closed ? 'closed' : 'open'}${path ? `&path=${q(path)}` : ''}`).then((d) => d.threads),
  proposal: (id) => request(`/proposals/${id}`).then((d) => d.thread),
  propose: (input) => request('/proposals', { method: 'POST', body: input }),
  revise: (id, input) => request(`/proposals/${id}`, { method: 'PATCH', body: input }).then((d) => d.thread),
  decide: (id, action) => request(`/proposals/${id}/${action}`, { method: 'POST' }).then((d) => d.thread),
}
