<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { session } from '../session.js'
import ProposalRow from '../components/ProposalRow.vue'
import AlertCard from '../components/AlertCard.vue'
import { awaitsMe } from '../lib/format.js'

const tab = ref('open')
const threads = ref([])
const alerts = ref([])
const loading = ref(true)
const error = ref('')

watch(
  tab,
  async (value) => {
    loading.value = true
    error.value = ''
    try {
      ;({ threads: threads.value, alerts: alerts.value } = await api.feed({ closed: value === 'closed' }))
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const toReview = computed(() => threads.value.filter((t) => t.proposals.some((p) => awaitsMe(p, session.user))))
const latest = (t) => Math.max(...t.proposals.map((p) => new Date(p.updated_at)))
const others = computed(() =>
  [
    ...threads.value.filter((t) => !toReview.value.includes(t)).map((t) => ({ thread: t, date: latest(t) })),
    ...alerts.value.map((a) => ({ alert: a, date: new Date(a.created_at).getTime() })),
  ].sort((a, b) => b.date - a.date),
)

function onDismissed(id) {
  alerts.value = alerts.value.filter((a) => a.id !== id)
}
</script>

<template>
  <div class="page">
    <div class="head">
      <h1>Proposals</h1>
      <div class="segmented">
        <button :class="{ active: tab === 'open' }" @click="tab = 'open'">Open</button>
        <button :class="{ active: tab === 'closed' }" @click="tab = 'closed'">Closed</button>
      </div>
    </div>
    <div v-if="loading" class="spinner"></div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else>
      <p v-if="!threads.length && !alerts.length" class="empty">
        {{ tab === 'open' ? 'No open proposals.' : 'No closed proposals yet.' }}
      </p>
      <section v-if="toReview.length">
        <h2>Waiting for your approval</h2>
        <div class="list">
          <ProposalRow v-for="t in toReview" :key="t.id" :thread="t" />
        </div>
      </section>
      <section v-if="others.length">
        <h2 v-if="toReview.length">Other proposals</h2>
        <div class="list">
          <template v-for="item in others" :key="item.thread?.id ?? item.alert.id">
            <ProposalRow v-if="item.thread" :thread="item.thread" />
            <AlertCard v-else :alert="item.alert" @dismissed="onDismissed" />
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.head h1 {
  margin: 0;
}

h2 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin: 22px 0 10px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
