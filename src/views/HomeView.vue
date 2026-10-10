<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { displayName, session } from '../session.js'
import { STATUS, SYSTEM_EVENTS, ago, eventLabel, isOpen } from '../lib/format.js'
import Avatar from '../components/Avatar.vue'
import Card from '../components/Card.vue'
import Icon from '../components/Icon.vue'

const threads = ref([])
const removals = ref([])
const loading = ref(Boolean(session.repo))
const error = ref('')

if (session.repo) {
  api
    .activity()
    .then((data) => {
      threads.value = data.threads
      removals.value = data.removals
    })
    .catch((err) => (error.value = err.message))
    .finally(() => (loading.value = false))
}

const feed = computed(() =>
  [
    ...threads.value.map((t) => ({ key: `thread:${t.id}`, date: t.updated_at, thread: t })),
    ...removals.value.map((r) => ({ key: `removal:${r.id}`, date: r.created_at, removal: r })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20),
)

function target(thread) {
  if (thread.kind === 'proposal') return { name: 'proposal', params: { id: thread.proposal.id } }
  return { name: 'file', params: { path: thread.path.split('/') }, query: { discussion: thread.id } }
}

const HEADLINES = {
  passage: 'started a discussion on',
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
  return { ...message, text: message.kind === 'event' ? eventLabel(message.body, thread.proposals) : message.body }
}
</script>

<template>
  <div class="page">
    <template v-if="!session.repo">
      <Card class="empty waiting">
        <h1>Almost ready!</h1>
        <p>The owner of the space hasn’t chosen the repository to open yet. Come back a little later.</p>
      </Card>
    </template>
    <template v-else>
      <h1>Hello {{ session.user.name?.split(' ')[0] || session.user.login }}</h1>
      <p class="muted intro">
        Open a file from the file list to read it. Select a passage to comment on it or propose a new
        wording: nothing is written to the repository without the approval of every other team member.
      </p>
      <h2>Recent activity</h2>
      <div v-if="loading" class="spinner"></div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <p v-else-if="!feed.length" class="faint">Nothing yet. Go ahead and start the first discussion!</p>
      <div v-else class="feed">
        <template v-for="{ key, thread: t, removal: r } in feed" :key="key">
          <Card v-if="r" class="item removal">
            <span class="removed-icon"><Icon name="trash" :size="16" /></span>
            <div class="text">
              <p class="line">
                <span class="path">{{ r.path }}</span> was deleted or moved outside Zigda
              </p>
              <p class="last faint">
                {{ r.discussions === 1 ? 'Its discussion was removed.' : `Its ${r.discussions} discussions were removed.` }}
              </p>
            </div>
            <div class="side">
              <span class="faint when">{{ ago(r.created_at) }}</span>
            </div>
          </Card>
          <Card v-else :to="target(t)" class="item">
            <Avatar :user="t.author" :size="32" />
            <div class="text">
              <p class="line">
                <strong>{{ displayName(t.author) }}</strong> {{ headline(t) }}
                <span class="path">{{ t.path }}</span>
              </p>
              <p v-if="last(t)" class="last faint">
                <template v-if="last(t).kind === 'event' && SYSTEM_EVENTS[last(t).body]">{{ last(t).text }}</template>
                <template v-else-if="last(t).kind === 'event'">{{ displayName(last(t).author) }} {{ last(t).text }}</template>
                <template v-else>{{ displayName(last(t).author) }}: “{{ last(t).text.slice(0, 140) }}”</template>
              </p>
            </div>
            <div class="side">
              <span v-if="t.proposal" class="badge" :class="t.proposal.status">{{ STATUS[t.proposal.status] }}</span>
              <span v-else-if="t.status === 'open' && t.proposals.some(isOpen)" class="badge pending">
                {{ STATUS.pending }}
              </span>
              <span v-else class="badge" :class="t.status === 'resolved' ? 'resolved' : 'pending'">
                {{ t.status === 'resolved' ? 'Closed' : 'Open' }}
              </span>
              <span class="faint when">{{ ago(t.updated_at) }}</span>
            </div>
          </Card>
        </template>
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

.item.removal:hover {
  border-color: var(--border);
}

.removed-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text-dim);
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

@media (max-width: 760px) {
  .item {
    padding: 12px;
    gap: 10px;
  }

  .last {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
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
