<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { ago } from '../lib/format.js'
import Icon from './Icon.vue'

const props = defineProps({ current: Object })
const emit = defineEmits(['saved'])

const repos = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('')
const selected = ref(null)
const branches = ref([])
const branch = ref('')
const saving = ref(false)

api
  .repos()
  .then((list) => (repos.value = list))
  .catch((err) => (error.value = err.message))
  .finally(() => (loading.value = false))

const shown = computed(() => {
  const term = filter.value.trim().toLowerCase()
  return term ? repos.value.filter((r) => r.full_name.toLowerCase().includes(term)) : repos.value
})

async function choose(repo) {
  selected.value = repo
  branches.value = []
  error.value = ''
  try {
    const data = await api.branches(repo.full_name)
    branches.value = data.branches
    const currentBranch = props.current?.owner === repo.owner && props.current?.name === repo.name ? props.current.branch : null
    branch.value = currentBranch ?? data.default_branch
  } catch (err) {
    error.value = err.message
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const { repo } = await api.saveRepo(selected.value.full_name, branch.value)
    emit('saved', repo)
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="picker">
    <div v-if="error" class="error">{{ error }}</div>
    <template v-if="!selected">
      <div class="search">
        <Icon name="search" :size="15" />
        <input v-model="filter" placeholder="Search for a repository" />
      </div>
      <div v-if="loading" class="spinner"></div>
      <div v-else class="repos">
        <button v-for="repo in shown" :key="repo.full_name" class="repo" @click="choose(repo)">
          <div>
            <strong>{{ repo.full_name }}</strong>
            <span v-if="repo.private" class="badge">Private</span>
            <p v-if="repo.description" class="faint">{{ repo.description }}</p>
          </div>
          <span class="faint when">{{ repo.updated_at ? ago(repo.updated_at) : '' }}</span>
        </button>
        <p v-if="!shown.length" class="faint">No repositories found.</p>
      </div>
    </template>
    <div v-else class="branch-step">
      <p>
        Selected repository: <strong>{{ selected.full_name }}</strong>
        <button class="btn ghost small" @click="selected = null">Change</button>
      </p>
      <label>Branch to work on</label>
      <select v-model="branch" :disabled="!branches.length">
        <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
      </select>
      <button class="btn primary" :disabled="!branch || saving" @click="save">
        <Icon name="check" :size="15" /> Confirm
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 0 14px;
  color: var(--text-faint);
}

.search input {
  border: 0;
  background: none;
  box-shadow: none;
  width: 100%;
}

.repos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow: auto;
}

.repo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.repo:hover {
  border-color: var(--accent);
}

.repo .badge {
  margin-left: 6px;
}

.repo p {
  margin: 3px 0 0;
  font-size: 13px;
}

.when {
  font-size: 12px;
  white-space: nowrap;
}

.branch-step {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.branch-step p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

label {
  font-weight: 700;
  font-size: 14px;
}

select {
  min-width: 240px;
}
</style>
