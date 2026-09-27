<script setup>
import { ref } from 'vue'
import { api } from '../api.js'
import { displayName, session } from '../session.js'
import { STATUS, ago, eventLabel } from '../lib/format.js'
import Avatar from '../components/Avatar.vue'

const threads = ref([])
const loading = ref(Boolean(session.repo))
const error = ref('')

if (session.repo) {
  api
    .activity()
    .then((list) => (threads.value = list))
    .catch((err) => (error.value = err.message))
    .finally(() => (loading.value = false))
}

function target(thread) {
  if (thread.kind === 'proposal') return { name: 'proposal', params: { id: thread.proposal.id } }
  return { name: 'file', params: { path: thread.path.split('/') }, query: { discussion: thread.id } }
}

const HEADLINES = {
  comment: 'started a discussion on',
  suggestion: 'suggested a change in',
  edit: 'proposed a change to',
  create: 'proposed creating',
  delete: 'proposed deleting',
}

function headline(thread) {
  return HEADLINES[thread.kind === 'proposal' ? thread.proposal.action : thread.kind]
}

function last(thread) {
  const message = thread.messages.at(-1)
  if (!message) return null
  return { ...message, text: message.kind === 'event' ? eventLabel(message.body) : message.body }
}
</script>

<template>
  <div class="page">
    <template v-if="!session.repo">
      <div class="empty card waiting">
        <h1>Almost ready!</h1>
        <p>The owner of the space hasn’t chosen the repository to open yet. Come back a little later.</p>
      </div>
    </template>
    <template v-else>
      <h1>Hello {{ session.user.name?.split(' ')[0] || session.user.login }}</h1>
      <p class="muted intro">
        Pick a file from the list on the left to read it. Select a passage to comment on it or suggest a change:
        nothing is written to the repository without the approval of every other team member.
      </p>
      <h2>Recent activity</h2>
      <div v-if="loading" class="spinner"></div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <p v-else-if="!threads.length" class="faint">Nothing yet. Go ahead and start the first discussion!</p>
      <div v-else class="feed">
        <RouterLink v-for="t in threads" :key="t.id" :to="target(t)" class="item card">
          <Avatar :user="t.author" :size="32" />
          <div class="text">
            <p class="line">
              <strong>{{ displayName(t.author) }}</strong> {{ headline(t) }}
              <span class="path">{{ t.path }}</span>
            </p>
            <p v-if="last(t)" class="last faint">
              <template v-if="last(t).kind === 'event'">{{ displayName(last(t).author) }} {{ last(t).text }}</template>
              <template v-else>{{ displayName(last(t).author) }}: “{{ last(t).text.slice(0, 140) }}”</template>
            </p>
          </div>
          <div class="side">
            <span v-if="t.proposal" class="badge" :class="t.proposal.status">{{ STATUS[t.proposal.status] }}</span>
            <span v-else class="badge" :class="t.status === 'resolved' ? 'resolved' : 'pending'">
              {{ t.status === 'resolved' ? 'Resolved' : 'Open' }}
            </span>
            <span class="faint when">{{ ago(t.updated_at) }}</span>
          </div>
        </RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.intro {
  max-width: 640px;
  line-height: 1.6;
  margin: -8px 0 28px;
}

h2 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin: 0 0 12px;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--text);
  box-shadow: none;
}

.item:hover {
  border-color: var(--border-strong);
}

.text {
  flex: 1;
  min-width: 0;
}

.text p {
  margin: 0;
}

.path {
  font-weight: 700;
  color: var(--accent-text);
}

.last {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px !important;
}

.side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.when {
  font-size: 12px;
}

.waiting {
  margin-top: 60px;
  padding: 40px;
}
</style>
