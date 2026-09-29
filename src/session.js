import { reactive } from 'vue'
import { api } from './api.js'

export const session = reactive({
  loaded: false,
  user: null,
  owner: null,
  repo: null,
  tokenReady: false,
  overview: { files: {}, toReview: 0 },
  treeVersion: 0,
})

export async function loadSession() {
  try {
    Object.assign(session, await api.me())
  } catch {
    if (!navigator.onLine) {
      await new Promise((resolve) => window.addEventListener('online', resolve, { once: true }))
      return loadSession()
    }
    session.user = null
  }
  session.loaded = true
  return session.user
}

export async function refreshOverview() {
  if (!session.user || !session.repo) return
  try {
    session.overview = await api.overview()
  } catch {}
}

export function repoChanged() {
  session.treeVersion++
  refreshOverview()
}

export async function logout() {
  await api.logout()
  session.user = null
}

export function displayName(user) {
  return user ? user.name || user.login : 'Deleted account'
}
