import { createRouter, createWebHistory } from 'vue-router'
import { loadSession, session } from './session.js'

const pathProps = (route) => ({ path: [].concat(route.params.path).join('/') })

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/setup', name: 'setup', component: () => import('./views/SetupView.vue'), meta: { bare: true } },
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/file/:path+', name: 'file', component: () => import('./views/FileView.vue'), props: pathProps },
    { path: '/edit/:path+', name: 'edit', component: () => import('./views/EditView.vue'), props: pathProps },
    { path: '/proposals', name: 'proposals', component: () => import('./views/ProposalsView.vue') },
    {
      path: '/proposals/:id',
      name: 'proposal',
      component: () => import('./views/ProposalView.vue'),
      props: true,
    },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
  ],
})

router.beforeEach(async (to) => {
  if (!session.loaded) await loadSession()
  if (to.meta.public) return session.user ? { name: 'home' } : true
  if (!session.user) return { name: 'login' }
  if (!session.repo && to.name !== 'setup' && to.name !== 'settings') {
    return session.user.role === 'root' ? { name: 'setup' } : true
  }
  if (to.name === 'setup' && session.user.role !== 'root') return { name: 'home' }
  return true
})

router.onError((error, to) => {
  const last = Number(sessionStorage.getItem('zigda:reloaded') ?? 0)
  if (Date.now() - last < 10_000) throw error
  sessionStorage.setItem('zigda:reloaded', Date.now())
  window.location.assign(to.fullPath)
})
