<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api.js'
import { displayName, repoChanged } from '../session.js'
import { ACTIONS, STATUS, ago, fullDate, proposalTitle } from '../lib/format.js'
import { isProse } from '../../shared/files.js'
import ThreadCard from '../components/ThreadCard.vue'
import DiffView from '../components/DiffView.vue'
import Avatar from '../components/Avatar.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ id: String })
const thread = ref(null)
const error = ref('')

const p = computed(() => thread.value?.proposal)
const prose = computed(() => (p.value ? isProse(p.value.path) : false))
const before = computed(() => p.value?.base_content ?? '')
const after = computed(() => (p.value?.action === 'delete' ? '' : (p.value?.content ?? '')))

async function load() {
  try {
    thread.value = await api.proposal(props.id)
    error.value = ''
  } catch (err) {
    error.value = err.message
  }
}

load()

let timer
onMounted(() => {
  timer = setInterval(() => document.visibilityState === 'visible' && load(), 15_000)
})
onBeforeUnmount(() => clearInterval(timer))

function onApplied() {
  load()
  repoChanged()
}
</script>

<template>
  <div class="page">
    <RouterLink to="/proposals" class="back"><Icon name="back" :size="15" /> All proposals</RouterLink>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="!thread" class="spinner"></div>
    <template v-else>
      <header class="head">
        <Avatar :user="p.author" :size="40" />
        <div class="head-text">
          <h1>{{ proposalTitle(p) }}</h1>
          <p class="muted">
            <strong>{{ displayName(p.author) }}</strong> ·
            <span :title="fullDate(p.created_at)">{{ ago(p.created_at) }}</span> ·
            <RouterLink v-if="p.status !== 'applied' || p.action !== 'delete'" :to="{ name: 'file', params: { path: p.path.split('/') } }">
              {{ p.path }}
            </RouterLink>
            <span v-else>{{ p.path }}</span>
          </p>
        </div>
        <span class="badge big" :class="p.status">{{ STATUS[p.status] }}</span>
      </header>

      <div class="layout">
        <section class="changes card">
          <div class="changes-head">
            <span class="kind">{{ ACTIONS[p.action] }}</span>
            <span v-if="p.action === 'delete'" class="muted">The file will be deleted from the repository.</span>
            <span v-else-if="p.action === 'create'" class="muted">New file.</span>
          </div>
          <DiffView :before="before" :after="after" :prose="prose" />
        </section>
        <div class="discussion">
          <ThreadCard :thread="thread" active @updated="thread = $event" @applied="onApplied" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  text-decoration: none;
  color: var(--text-dim);
  margin-bottom: 16px;
}

.head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.head-text {
  flex: 1;
  min-width: 0;
}

.head h1 {
  margin: 0;
  font-size: 22px;
}

.head p {
  margin: 3px 0 0;
  font-size: 14px;
}

.badge.big {
  font-size: 13px;
  padding: 4px 12px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.changes {
  padding: 18px 22px;
  min-width: 0;
}

.changes-head {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 12px;
  font-size: 14px;
}

.kind {
  font-weight: 800;
}

.discussion {
  position: sticky;
  top: 0;
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
