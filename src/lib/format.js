const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const full = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' })

export function ago(date) {
  const seconds = (new Date(date) - Date.now()) / 1000
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function fullDate(date) {
  return full.format(new Date(date))
}

export const STATUS = {
  pending: 'Pending',
  applying: 'In progress',
  applied: 'Applied',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  conflict: 'Needs rework',
  discarded: 'Not retained',
}

export const ACTIONS = {
  edit: 'Edit',
  create: 'New file',
  delete: 'Deletion',
  replace: 'New wording',
}

const TITLES = {
  edit: 'Edit of',
  create: 'Creation of',
  delete: 'Deletion of',
  replace: 'New wording in',
}

export function isOpen(p) {
  return ['pending', 'conflict', 'applying'].includes(p.status)
}

export function awaitsMe(p, user) {
  return p.status === 'pending' && !p.blocked && p.author?.id !== user.id && p.waiting_for.some((u) => u.id === user.id)
}

export function proposalTitle(p) {
  return p.title || `${TITLES[p.action]} ${p.path.split('/').pop()}`
}

export const CONFLICTS = {
  file_exists: 'A file with the same name was created in the meantime.',
  file_missing: 'The file was deleted in the meantime.',
  file_binary: 'The file is no longer text.',
}

export const DISCARDED = {
  other_version: 'Another version was applied.',
  passage_missing: 'The passage was changed directly in the repository.',
  author_removed: 'Its author was removed from the team.',
}

export const SYSTEM_EVENTS = {
  passage_missing: 'The passage was changed directly in the repository: the discussion has been closed.',
}

export function eventLabel(body, versions = []) {
  if (body.startsWith('conflict:')) return `tried to approve, but ${CONFLICTS[body.slice(9)]?.toLowerCase() ?? 'a conflict occurred.'}`
  if (SYSTEM_EVENTS[body]) return SYSTEM_EVENTS[body]
  const [name, id] = body.split('@')
  const index = versions.findIndex((v) => v.id === id)
  const version = versions.length > 1 && index !== -1 ? `version ${index + 1}` : null
  return (
    {
      approved: version ? `approved ${version}.` : 'approved.',
      applied: `gave the final approval: ${version ?? 'the change'} has been applied to the repository.`,
      'applied:auto': `removed a team member: all remaining approvals are in, ${version ?? 'the change'} has been applied to the repository.`,
      'updated:reset': `updated ${version ?? 'their proposal'}: approvals have been reset.`,
      updated: `updated ${version ?? 'their proposal'}.`,
      rejected: `rejected ${version ?? 'the proposal'}.`,
      withdrawn: `withdrew ${version ?? 'their proposal'}.`,
      proposed: `proposed ${version ?? 'a modification'}.`,
      author_removed: `removed its author from the team: ${version ?? 'the proposal'} has been cancelled.`,
      resolved: 'marked the discussion as resolved.',
      reopened: 'reopened the discussion.',
    }[name] ?? body
  )
}
