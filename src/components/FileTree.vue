<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { session } from '../session.js'
import { dirname } from '../../shared/files.js'
import TreeNode from './TreeNode.vue'
import Icon from './Icon.vue'

const route = useRoute()
const router = useRouter()
const entries = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('')
const creating = ref(false)
const newPath = ref('')
const newInput = ref(null)

function readExpanded() {
  try {
    return JSON.parse(localStorage.getItem('zigda:expanded') ?? '[]')
  } catch {
    return []
  }
}

const expanded = reactive(new Set(readExpanded()))

watch(
  () => [...expanded],
  (list) => {
    try {
      localStorage.setItem('zigda:expanded', JSON.stringify(list))
    } catch {}
  },
)

async function load() {
  error.value = ''
  try {
    entries.value = (await api.tree()).entries
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(() => session.treeVersion, load, { immediate: true })

const current = computed(() => (route.name === 'file' || route.name === 'edit' ? [].concat(route.params.path).join('/') : null))

watch(
  current,
  (path) => {
    if (!path) return
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'))
  },
  { immediate: true },
)

const root = computed(() => {
  const top = { path: '', name: '', type: 'tree', children: [] }
  const folders = new Map([['', top]])
  const sorted = [...entries.value].sort((a, b) => a.path.localeCompare(b.path))
  for (const entry of sorted) {
    const node = { ...entry, name: entry.path.split('/').pop(), children: entry.type === 'tree' ? [] : null }
    if (entry.type === 'tree') folders.set(entry.path, node)
    ;(folders.get(dirname(entry.path)) ?? top).children.push(node)
  }
  const order = (node) => {
    if (!node.children) return
    node.children.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) : a.type === 'tree' ? -1 : 1,
    )
    node.children.forEach(order)
  }
  order(top)
  return top
})

const matches = computed(() => {
  const term = filter.value.trim().toLowerCase()
  if (!term) return null
  return entries.value.filter((e) => e.type === 'blob' && e.path.toLowerCase().includes(term)).slice(0, 200)
})

function toggle(path) {
  if (expanded.has(path)) expanded.delete(path)
  else expanded.add(path)
}

function startCreate() {
  const base = current.value ? dirname(current.value) : ''
  newPath.value = base ? `${base}/` : ''
  creating.value = true
  nextTick(() => newInput.value?.focus())
}

function create() {
  const path = newPath.value.trim().replace(/^\/+/, '')
  if (!path || path.endsWith('/')) return
  creating.value = false
  router.push({ name: 'edit', params: { path: path.split('/') }, query: { new: '1' } })
}
</script>

<template>
  <div class="tree">
    <div class="tree-head">
      <div class="search">
        <Icon name="search" :size="15" />
        <input v-model="filter" placeholder="Search for a file" />
      </div>
      <button class="btn ghost small" title="New file" @click="startCreate"><Icon name="plus" /></button>
    </div>
    <form v-if="creating" class="create" @submit.prevent="create">
      <label class="faint">Path of the new file</label>
      <input ref="newInput" v-model="newPath" placeholder="folder/name.md" @keydown.esc="creating = false" />
      <div class="create-actions">
        <button type="button" class="btn ghost small" @click="creating = false">Cancel</button>
        <button class="btn primary small">Create</button>
      </div>
    </form>
    <div class="tree-body">
      <div v-if="loading" class="spinner"></div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <template v-else-if="matches">
        <RouterLink
          v-for="entry in matches"
          :key="entry.path"
          :to="{ name: 'file', params: { path: entry.path.split('/') } }"
          class="match"
          :class="{ active: entry.path === current }"
        >
          <span class="match-name">{{ entry.path.split('/').pop() }}</span>
          <span class="match-dir faint">{{ dirname(entry.path) }}</span>
        </RouterLink>
        <p v-if="!matches.length" class="faint none">No files found.</p>
      </template>
      <TreeNode
        v-for="child in root.children"
        v-else
        :key="child.path"
        :node="child"
        :depth="0"
        :expanded="expanded"
        :current="current"
        :activity="session.overview.files"
        @toggle="toggle"
      />
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 290px;
}

.tree-head {
  display: flex;
  gap: 6px;
  padding: 12px 10px 8px 12px;
}

.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 12px;
  color: var(--text-faint);
}

.search input {
  border: 0;
  background: none;
  padding: 7px 0;
  width: 100%;
  box-shadow: none;
}

.create {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 10px 8px 12px;
  padding: 10px;
  font-size: 13px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.tree-body {
  flex: 1;
  overflow: auto;
  padding: 2px 8px 30px;
}

.match {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text);
}

.match:hover {
  background: var(--surface-3);
}

.match.active {
  background: var(--accent-soft);
}

.match-name {
  font-weight: 700;
}

.match-dir {
  font-size: 12px;
}

.none {
  padding: 10px;
}
</style>
