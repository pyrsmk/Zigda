<script setup>
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { ago, fullDate } from '../lib/format.js'
import Avatar from './Avatar.vue'
import Card from './Card.vue'

const props = defineProps({ path: String, sha: String })

const commits = ref([])
const loading = ref(true)
const error = ref('')
const openSha = ref(null)
const details = ref({})

watch(
  () => [props.path, props.sha],
  async () => {
    loading.value = true
    error.value = ''
    try {
      commits.value = await api.history(props.path)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

async function toggle(sha) {
  openSha.value = openSha.value === sha ? null : sha
  if (openSha.value && !details.value[sha]) {
    try {
      details.value[sha] = await api.commit(props.path, sha)
    } catch (err) {
      details.value[sha] = { error: err.message }
    }
  }
}

function lineClass(line) {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return ''
}

function title(message) {
  return message.split('\n')[0]
}

function detail(message) {
  return message.split('\n').slice(1).join('\n').trim()
}
</script>

<template>
  <div class="history">
    <div v-if="loading" class="spinner"></div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <p v-else-if="!commits.length" class="faint">No history for this file.</p>
    <Card v-for="c in commits" :key="c.sha" class="commit" :class="{ open: openSha === c.sha }">
      <button class="commit-head" @click="toggle(c.sha)">
        <Avatar :user="{ name: c.author.name, avatar_url: c.author.avatar_url }" :size="24" />
        <div class="commit-text">
          <strong>{{ title(c.message) }}</strong>
          <span class="faint" :title="fullDate(c.date)">{{ c.author.name }} · {{ ago(c.date) }}</span>
        </div>
      </button>
      <div v-if="openSha === c.sha" class="commit-body">
        <p v-if="detail(c.message)" class="faint note">{{ detail(c.message) }}</p>
        <div v-if="!details[c.sha]" class="spinner"></div>
        <div v-else-if="details[c.sha].error" class="error">{{ details[c.sha].error }}</div>
        <pre v-else-if="details[c.sha].patch" class="patch"><span
            v-for="(line, i) in details[c.sha].patch.split('\n')"
            :key="i"
            :class="lineClass(line)"
          >{{ line || ' ' }}</span></pre>
        <p v-else class="faint">No details available (file too large or binary).</p>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.commit {
  box-shadow: none;
  overflow: hidden;
}

.commit-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 12px;
  width: 100%;
  text-align: left;
}

.commit-head:hover {
  background: var(--surface-2);
}

.commit-text {
  display: flex;
  flex-direction: column;
  font-size: 13.5px;
  min-width: 0;
}

.commit-text strong {
  overflow-wrap: anywhere;
}

.commit-text .faint {
  font-size: 12px;
}

.commit-body {
  padding: 0 12px 12px;
}

.note {
  font-size: 12px;
  white-space: pre-wrap;
  margin: 0 0 8px;
}

.patch {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 0;
  overflow-x: auto;
}

.patch span {
  display: block;
  padding: 0 10px;
  white-space: pre;
}

.patch .add {
  background: var(--ok-soft);
}

.patch .del {
  background: var(--danger-soft);
}

.patch .hunk {
  color: var(--text-faint);
}
</style>
