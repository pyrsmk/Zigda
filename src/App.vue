<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout, refreshOverview, session } from './session.js'
import FileTree from './components/FileTree.vue'
import Avatar from './components/Avatar.vue'
import Icon from './components/Icon.vue'

const route = useRoute()
const router = useRouter()
const chrome = computed(() => session.user && !route.meta.public && !route.meta.bare)
const sidebarOpen = ref(true)
const menuOpen = ref(false)

let timer
function poll() {
  if (document.visibilityState === 'visible') refreshOverview()
}

onMounted(() => {
  timer = setInterval(poll, 30_000)
  document.addEventListener('visibilitychange', poll)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', poll)
})

watch(
  () => session.user && session.repo,
  (ready) => ready && refreshOverview(),
  { immediate: true },
)

async function signOut() {
  menuOpen.value = false
  await logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="chrome" class="shell" :class="{ collapsed: !sidebarOpen }">
    <header class="topbar">
      <button class="btn ghost small toggle" title="Show or hide files" @click="sidebarOpen = !sidebarOpen">
        <Icon name="menu" />
      </button>
      <RouterLink to="/" class="brand">
        <img src="/icon.svg" alt="" width="26" height="26" />
        <span>Zigda</span>
      </RouterLink>
      <span v-if="session.repo" class="repo" :title="`${session.repo.owner}/${session.repo.name}`">
        {{ session.repo.name }}
        <span class="branch"><Icon name="branch" :size="13" />{{ session.repo.branch }}</span>
      </span>
      <nav>
        <RouterLink to="/proposals" class="nav-link">
          <Icon name="inbox" />
          <span>Proposals</span>
          <span v-if="session.overview.toReview" class="badge count" title="Waiting for your approval">
            {{ session.overview.toReview }}
          </span>
        </RouterLink>
        <RouterLink v-if="session.user.role === 'root'" to="/settings" class="nav-link">
          <Icon name="settings" />
          <span>Settings</span>
        </RouterLink>
      </nav>
      <div class="me">
        <button class="me-button" @click="menuOpen = !menuOpen">
          <Avatar :user="session.user" :size="30" />
        </button>
        <div v-if="menuOpen" class="menu card" @click.stop>
          <div class="menu-head">
            <strong>{{ session.user.name || session.user.login }}</strong>
            <span class="faint">@{{ session.user.login }}</span>
          </div>
          <button class="menu-item" @click="signOut"><Icon name="logout" /> Sign out</button>
        </div>
      </div>
    </header>
    <aside class="sidebar">
      <FileTree v-if="session.repo" />
    </aside>
    <main class="main" @click="menuOpen = false">
      <RouterView :key="route.name === 'file' ? 'file' : route.fullPath" />
    </main>
  </div>
  <RouterView v-else />
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 290px 1fr;
  grid-template-rows: 58px 1fr;
  height: 100%;
}

.shell.collapsed {
  grid-template-columns: 0 1fr;
}

.topbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 800;
  font-size: 18px;
  color: var(--text);
  text-decoration: none;
}

.repo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
  font-weight: 700;
  color: var(--text-dim);
  min-width: 0;
}

.branch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: var(--surface-2);
  padding: 2px 9px;
  border-radius: 999px;
}

nav {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border-radius: 999px;
  color: var(--text-dim);
  font-weight: 700;
  text-decoration: none;
}

.nav-link:hover {
  background: var(--surface-2);
}

.nav-link.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.me {
  position: relative;
}

.me-button {
  display: flex;
  border-radius: 50%;
}

.menu {
  position: absolute;
  right: 0;
  top: 42px;
  width: 220px;
  padding: 8px;
  z-index: 20;
}

.menu-head {
  display: flex;
  flex-direction: column;
  padding: 6px 10px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.menu-item:hover {
  background: var(--surface-2);
}

.sidebar {
  background: var(--surface-2);
  border-right: 1px solid var(--border);
  overflow: hidden;
  min-height: 0;
}

.main {
  overflow: auto;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 760px) {
  .shell {
    grid-template-columns: 0 1fr;
  }

  .shell:not(.collapsed) {
    grid-template-columns: 260px 1fr;
  }

  .repo,
  .nav-link span:not(.badge),
  .brand span {
    display: none;
  }
}
</style>
