<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { session } from '../session.js'
import ProposalRow from '../components/ProposalRow.vue'
import { awaitsMe } from '../lib/format.js'

const tab = ref('open')
const threads = ref([])
const loading = ref(true)
const error = ref('')

watch(
  tab,
  async (value) => {
    loading.value = true
    error.value = ''
    try {
      threads.value = await api.proposals({ closed: value === 'closed' })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const toReview = computed(() =>
  threads.value.filter((t) => awaitsMe(t.proposal, session.user)),
)
const others = computed(() => threads.value.filter((t) => !toReview.value.includes(t)))
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
      <p v-if="!threads.length" class="empty">
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
          <ProposalRow v-for="t in others" :key="t.id" :thread="t" />
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
