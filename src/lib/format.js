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
}

export const ACTIONS = {
  edit: 'Edit',
  create: 'New file',
  delete: 'Deletion',
  replace: 'Suggestion',
}

const TITLES = {
  edit: 'Edit of',
  create: 'Creation of',
  delete: 'Deletion of',
  replace: 'Suggestion in',
}

export function awaitsMe(p, user) {
  return p.status === 'pending' && p.author?.id !== user.id && p.waiting_for.some((u) => u.id === user.id)
}

export function proposalTitle(p) {
  return p.title || `${TITLES[p.action]} ${p.path.split('/').pop()}`
}

export const CONFLICTS = {
  file_exists: 'A file with the same name was created in the meantime.',
  file_missing: 'The file was deleted in the meantime.',
  file_binary: 'The file is no longer text.',
  file_changed: 'The file was changed in the meantime.',
  passage_missing: 'The targeted passage was changed in the meantime and no longer exists as is.',
  merge_conflict: 'The file was changed in the same place in the meantime.',
}

export function eventLabel(body) {
  if (body.startsWith('conflict:')) return `tried to approve, but ${CONFLICTS[body.slice(9)]?.toLowerCase() ?? 'a conflict occurred.'}`
  return (
    {
      approved: 'approved.',
      applied: 'gave the final approval: the change has been applied to the repository.',
      'applied:auto': 'removed a team member: all remaining approvals are in, the change has been applied to the repository.',
      'updated:reset': 'updated their proposal: approvals have been reset.',
      rejected: 'rejected the proposal.',
      withdrawn: 'withdrew their proposal.',
      updated: 'updated their proposal.',
      resolved: 'marked the discussion as resolved.',
      reopened: 'reopened the discussion.',
    }[body] ?? body
  )
}
