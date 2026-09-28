<script setup>
import { ref } from 'vue'
import { api } from '../api.js'
import { repoChanged, session } from '../session.js'
import { ago } from '../lib/format.js'
import RepoPicker from '../components/RepoPicker.vue'
import Avatar from '../components/Avatar.vue'
import Icon from '../components/Icon.vue'

const members = ref([])
const invitations = ref([])
const login = ref('')
const error = ref('')
const inviting = ref(false)
const changingRepo = ref(false)
const confirmRemove = ref(null)

async function load() {
  try {
    const data = await api.members()
    members.value = data.members
    invitations.value = data.invitations
  } catch (err) {
    error.value = err.message
  }
}

load()

async function invite() {
  inviting.value = true
  error.value = ''
  try {
    await api.invite(login.value)
    login.value = ''
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    inviting.value = false
  }
}

async function remove(target) {
  error.value = ''
  try {
    await api.removeMember(target)
    confirmRemove.value = null
    await load()
  } catch (err) {
    error.value = err.message
  }
}

function saved(repo) {
  session.repo = repo
  changingRepo.value = false
  repoChanged()
}
</script>

<template>
  <div class="page">
    <h1>Settings</h1>

    <section class="card block">
      <h2><Icon name="branch" /> Repository</h2>
      <template v-if="session.repo && !changingRepo">
        <p>
          The team is working on <strong>{{ session.repo.owner }}/{{ session.repo.name }}</strong>, branch
          <strong>{{ session.repo.branch }}</strong>.
        </p>
        <button class="btn small" @click="changingRepo = true">Change repository or branch</button>
      </template>
      <template v-else>
        <RepoPicker :current="session.repo" @saved="saved" />
        <button v-if="session.repo" class="btn ghost small cancel" @click="changingRepo = false">Cancel</button>
      </template>
    </section>

    <section class="card block">
      <h2><Icon name="users" /> Team</h2>
      <p class="muted">
        Invite someone by their GitHub username. They don’t need any access to the repository: Zigda
        writes approved changes on their behalf, under their name.
      </p>
      <form class="invite" @submit.prevent="invite">
        <input v-model="login" placeholder="GitHub username (e.g. octocat)" />
        <button class="btn primary" :disabled="inviting || !login.trim()"><Icon name="plus" :size="15" /> Invite</button>
      </form>
      <div v-if="error" class="error">{{ error }}</div>

      <ul class="people">
        <li v-for="m in members" :key="m.id">
          <Avatar :user="m" :size="34" />
          <div class="who">
            <strong>{{ m.name || m.login }}</strong>
            <span class="faint">@{{ m.login }}<template v-if="m.last_seen_at"> · seen {{ ago(m.last_seen_at) }}</template></span>
          </div>
          <span v-if="m.role === 'root'" class="badge">Owner</span>
          <template v-else-if="confirmRemove === m.login">
            <button class="btn ghost small" @click="confirmRemove = null">Cancel</button>
            <button class="btn danger small" @click="remove(m.login)">Confirm removal</button>
          </template>
          <button v-else class="btn ghost small" @click="confirmRemove = m.login">Remove</button>
        </li>
        <li v-for="inv in invitations" :key="inv.login" class="pending">
          <Avatar :user="{ login: inv.login, avatar_url: inv.avatar_url }" :size="34" />
          <div class="who">
            <strong>@{{ inv.login }}</strong>
            <span class="faint">Invitation sent {{ ago(inv.created_at) }}, waiting for their first sign-in</span>
          </div>
          <button class="btn ghost small" @click="remove(inv.login)">Cancel invitation</button>
        </li>
      </ul>
    </section>

    <section class="card block">
      <h2><Icon name="refresh" /> GitHub connection</h2>
      <p class="muted">
        Zigda accesses the repository through your account. If GitHub denies access (password changed, access revoked…),
        reconnect it here.
      </p>
      <p v-if="!session.tokenReady" class="notice">GitHub access is not configured.</p>
      <a href="/api/auth/login?scope=repo" class="btn small">Reconnect my GitHub account</a>
    </section>
  </div>
</template>

<style scoped>
.block {
  padding: 22px 24px;
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.block > * {
  margin: 0;
}

h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
}

p {
  line-height: 1.55;
}

.cancel {
  margin-top: -4px;
}

.block :deep(.picker) {
  width: 100%;
}

.invite {
  display: flex;
  gap: 8px;
  width: 100%;
}

.invite input {
  flex: 1;
  min-width: 0;
}

.people {
  list-style: none;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.people li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
}

.people li:hover {
  background: var(--surface-2);
}

.people li.pending {
  opacity: 0.8;
}

.who {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.who .faint {
  font-size: 13px;
}
</style>
