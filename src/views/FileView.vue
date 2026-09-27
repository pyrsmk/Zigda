<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { refreshOverview, repoChanged, session, displayName } from '../session.js'
import { codeTree, markdownTree, plainTree, renderHtml, selectionRange } from '../lib/render.js'
import { ago } from '../lib/format.js'
import { makeAnchor, locate } from '../../shared/anchor.js'
import { imageType, isMarkdown, isProse, language } from '../../shared/files.js'
import ThreadCard from '../components/ThreadCard.vue'
import Composer from '../components/Composer.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import Icon from '../components/Icon.vue'
import Avatar from '../components/Avatar.vue'

const props = defineProps({ path: String })
const router = useRouter()
const route = useRoute()

const file = ref(null)
const loading = ref(true)
const error = ref('')
const threads = ref([])
const proposals = ref([])
const activeId = ref(null)
const draft = ref(null)
const bubble = ref(null)
const panel = ref('threads')
const showResolved = ref(false)
const content = ref(null)
const confirmDelete = ref(false)
const deleting = ref(false)

function readMode() {
  try {
    return localStorage.getItem('zigda:mode') ?? 'formatted'
  } catch {
    return 'formatted'
  }
}

const mode = ref(readMode())
watch(mode, (value) => {
  try {
    localStorage.setItem('zigda:mode', value)
  } catch {}
})

const image = computed(() => imageType(props.path))
const prose = computed(() => isProse(props.path))
const lang = computed(() => language(props.path))
const text = computed(() => file.value?.content ?? null)
const lineCount = computed(() => (text.value ?? '').split('\n').length)
const layout = computed(() => {
  if (mode.value === 'raw') return prose.value ? 'raw-prose' : 'raw-code'
  if (isMarkdown(props.path)) return 'markdown'
  return prose.value ? 'plain' : 'code'
})

const tree = computed(() => {
  if (text.value === null) return null
  if (layout.value === 'markdown') return markdownTree(text.value, props.path)
  if (layout.value === 'code') return codeTree(text.value, lang.value)
  return plainTree(text.value)
})

const placed = computed(() =>
  threads.value.map((thread) => {
    if (!thread.anchor || text.value === null) return { thread, range: null }
    const { anchor } = thread
    const same = thread.base_sha === file.value.sha && text.value.slice(anchor.start, anchor.end) === anchor.quote
    return { thread, range: same ? { start: anchor.start, end: anchor.end } : locate(text.value, anchor) }
  }),
)

const visible = computed(() =>
  placed.value
    .filter(({ thread }) => showResolved.value || thread.status === 'open')
    .sort((a, b) => (a.range?.start ?? Infinity) - (b.range?.start ?? Infinity)),
)

const resolvedCount = computed(() => threads.value.filter((t) => t.status === 'resolved').length)

const html = computed(() => {
  if (!tree.value) return ''
  const ranges = visible.value
    .filter(({ range }) => range)
    .map(({ thread, range }) => ({
      ...range,
      id: thread.id,
      tone: thread.id === activeId.value ? 'active' : thread.kind,
    }))
  if (draft.value) ranges.push({ ...draft.value.range, id: 'draft', tone: 'draft' })
  return renderHtml(tree.value, ranges)
})

async function loadFile() {
  try {
    const fresh = await api.file(props.path)
    if (!file.value || fresh.sha !== file.value.sha) file.value = fresh
    error.value = ''
  } catch (err) {
    error.value = err.message
    file.value = null
  }
}

async function loadThreads() {
  try {
    const [t, p] = await Promise.all([api.threads(props.path), api.proposals({ path: props.path })])
    threads.value = t
    proposals.value = p.filter((thread) => thread.kind === 'proposal')
  } catch {}
}

async function load() {
  loading.value = true
  file.value = null
  threads.value = []
  proposals.value = []
  draft.value = null
  activeId.value = null
  bubble.value = null
  confirmDelete.value = false
  await Promise.all([loadFile(), loadThreads()])
  loading.value = false
  const wanted = route.query.discussion
  if (wanted && threads.value.some((t) => t.id === wanted)) {
    showResolved.value = threads.value.find((t) => t.id === wanted).status === 'resolved' || showResolved.value
    await nextTick()
    select(wanted)
  }
}

watch(() => props.path, load, { immediate: true })

let tick = 0
let timer
function poll() {
  if (document.visibilityState !== 'visible' || loading.value) return
  loadThreads()
  if (++tick % 4 === 0 && !draft.value) loadFile()
}

onMounted(() => {
  timer = setInterval(poll, 15_000)
  document.addEventListener('selectionchange', onSelectionChange)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('selectionchange', onSelectionChange)
})

function trimRange(start, end) {
  const value = text.value
  while (start < end && /\s/.test(value[start])) start++
  while (end > start && /\s/.test(value[end - 1])) end--
  return end > start ? { start, end } : null
}

function onMouseUp() {
  const sel = content.value && selectionRange(content.value)
  if (!sel) return
  const range = trimRange(sel.start, sel.end)
  if (!range) return
  bubble.value = { ...range, top: sel.rect.top - 46, left: sel.rect.left + sel.rect.width / 2 }
}

function onSelectionChange() {
  if (bubble.value && window.getSelection()?.isCollapsed) bubble.value = null
}

function startDraft(kind) {
  const { start, end } = bubble.value
  draft.value = { kind, range: { start, end }, anchor: makeAnchor(text.value, start, end) }
  bubble.value = null
  activeId.value = null
  panel.value = 'threads'
  window.getSelection()?.removeAllRanges()
}

function onContentClick(event) {
  const link = event.target.closest('a[data-internal]')
  if (link) {
    event.preventDefault()
    router.push({ name: 'file', params: { path: link.dataset.internal.split('/') } })
    return
  }
  if (!window.getSelection()?.isCollapsed) return
  const mark = event.target.closest('[data-t]')
  if (!mark) return
  const ids = mark.dataset.t.split(' ').filter((id) => id !== 'draft')
  if (!ids.length) return
  const index = ids.indexOf(activeId.value)
  select(ids[(index + 1) % ids.length])
}

async function select(id) {
  activeId.value = id
  panel.value = 'threads'
  await nextTick()
  document.getElementById(`thread-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const mark = content.value?.querySelector(`[data-t~="${id}"]`)
  mark?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function onCreated(thread) {
  threads.value.push(thread)
  draft.value = null
  activeId.value = thread.id
}

function onUpdated(thread) {
  const index = threads.value.findIndex((t) => t.id === thread.id)
  if (index !== -1) threads.value[index] = thread
  if (thread.status === 'resolved' && !showResolved.value && activeId.value === thread.id) activeId.value = null
}

async function onApplied() {
  await Promise.all([loadFile(), loadThreads()])
}

async function proposeDelete() {
  deleting.value = true
  try {
    const { id } = await api.propose({ path: props.path, action: 'delete' })
    refreshOverview()
    router.push({ name: 'proposal', params: { id } })
  } catch (err) {
    error.value = err.message
  } finally {
    deleting.value = false
  }
}

const crumbs = computed(() => props.path.split('/'))
</script>

<template>
  <div class="file-view">
    <header class="file-head">
      <div class="crumbs">
        <template v-for="(part, i) in crumbs" :key="i">
          <span v-if="i" class="sep">/</span>
          <span :class="{ last: i === crumbs.length - 1 }">{{ part }}</span>
        </template>
      </div>
      <div class="tools">
        <div v-if="text !== null" class="segmented">
          <button :class="{ active: mode === 'formatted' }" @click="mode = 'formatted'">
            <Icon name="eye" :size="13" /> Formatted
          </button>
          <button :class="{ active: mode === 'raw' }" @click="mode = 'raw'">
            <Icon name="code" :size="13" /> Raw text
          </button>
        </div>
        <RouterLink v-if="text !== null" :to="{ name: 'edit', params: { path: path.split('/') } }" class="btn primary small">
          <Icon name="pencil" :size="14" /> Edit
        </RouterLink>
        <button v-if="file" class="btn ghost small" title="Propose deletion" @click="confirmDelete = !confirmDelete">
          <Icon name="trash" :size="15" />
        </button>
      </div>
    </header>

    <div v-if="confirmDelete" class="notice confirm">
      Propose deleting this file? It will only take effect once every other team member has approved.
      <div class="confirm-actions">
        <button class="btn ghost small" @click="confirmDelete = false">Cancel</button>
        <button class="btn danger small" :disabled="deleting" @click="proposeDelete">Propose deletion</button>
      </div>
    </div>

    <div v-if="proposals.length" class="pending-list">
      <RouterLink
        v-for="p in proposals"
        :key="p.id"
        :to="{ name: 'proposal', params: { id: p.proposal.id } }"
        class="pending"
      >
        <Avatar :user="p.author" :size="22" />
        <span>
          <strong>{{ displayName(p.author) }}</strong>
          proposes {{ p.proposal.action === 'delete' ? 'deleting this file' : 'a change' }}
          <span v-if="p.proposal.title" class="muted">“{{ p.proposal.title }}”</span>
        </span>
        <span class="faint">{{ ago(p.proposal.updated_at) }}</span>
        <span class="badge" :class="p.proposal.status">View</span>
      </RouterLink>
    </div>

    <div class="body">
      <section class="content-area" @scroll="bubble = null">
        <div v-if="loading" class="spinner"></div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else-if="image" class="image-box">
          <img :src="`/api/raw?path=${encodeURIComponent(path)}&v=${file.sha}`" :alt="path" />
        </div>
        <div v-else-if="text === null" class="empty">This file is not text and cannot be displayed.</div>
        <div v-else class="paper" :class="layout">
          <div v-if="layout === 'code' || layout === 'raw-code'" class="gutter" aria-hidden="true">
            <span v-for="n in lineCount" :key="n">{{ n }}</span>
          </div>
          <div
            ref="content"
            class="content"
            :class="{ prose: layout === 'markdown' }"
            @mouseup="onMouseUp"
            @click="onContentClick"
            v-html="html"
          ></div>
        </div>
      </section>

      <aside v-if="text !== null || image" class="panel">
        <div class="panel-tabs">
          <div class="segmented">
            <button :class="{ active: panel === 'threads' }" @click="panel = 'threads'">
              <Icon name="message" :size="13" /> Discussions
            </button>
            <button :class="{ active: panel === 'history' }" @click="panel = 'history'">
              <Icon name="history" :size="13" /> History
            </button>
          </div>
        </div>
        <template v-if="panel === 'threads'">
          <Composer
            v-if="draft"
            :draft="draft"
            :path="path"
            :sha="file.sha"
            :prose="prose"
            @cancel="draft = null"
            @created="onCreated"
          />
          <p v-if="!visible.length && !draft && text !== null" class="hint faint">
            Select a passage of the text to comment on it or suggest a change.
          </p>
          <div
            v-for="{ thread, range } in visible"
            :id="`thread-${thread.id}`"
            :key="thread.id"
            class="thread-slot"
          >
            <ThreadCard
              :thread="thread"
              :active="thread.id === activeId"
              :orphan="!range"
              compact
              :prose="prose"
              @select="select"
              @updated="onUpdated"
              @applied="onApplied"
            />
          </div>
          <button v-if="resolvedCount" class="btn ghost small toggle-resolved" @click="showResolved = !showResolved">
            {{ showResolved ? 'Hide' : 'Show' }} closed discussions ({{ resolvedCount }})
          </button>
        </template>
        <HistoryPanel v-else :path="path" :sha="file?.sha" />
      </aside>
    </div>

    <Teleport to="body">
      <div v-if="bubble" class="bubble" :style="{ top: `${bubble.top}px`, left: `${bubble.left}px` }" @mousedown.prevent>
        <button @click="startDraft('comment')"><Icon name="message" :size="14" /> Comment</button>
        <button @click="startDraft('suggestion')"><Icon name="sparkle" :size="14" /> Suggest a change</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.file-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.file-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-wrap: wrap;
}

.crumbs {
  font-weight: 700;
  color: var(--text-dim);
  min-width: 0;
  overflow-wrap: anywhere;
}

.crumbs .last {
  color: var(--text);
  font-weight: 800;
  font-size: 17px;
}

.sep {
  margin: 0 5px;
  color: var(--text-faint);
}

.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.segmented button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.confirm {
  margin: 12px 24px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.confirm-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 24px 0;
}

.pending {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: var(--accent-soft);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text);
  font-size: 14px;
}

.pending > span:nth-child(2) {
  flex: 1;
}

.body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 0;
}

.content-area {
  overflow: auto;
  padding: 22px 24px 80px;
}

.paper {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  min-width: 0;
}

.paper.markdown,
.paper.plain,
.paper.raw-prose {
  padding: 34px 44px;
  justify-content: center;
}

.paper.code,
.paper.raw-code {
  overflow-x: auto;
  padding: 14px 0;
}

.gutter {
  display: flex;
  flex-direction: column;
  text-align: right;
  padding: 0 12px 0 16px;
  color: var(--text-faint);
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.6;
  user-select: none;
  border-right: 1px solid var(--border);
  position: sticky;
  left: 0;
  background: var(--surface);
}

.content {
  min-width: 0;
  flex: 1;
  tab-size: 4;
}

.paper.markdown .content {
  max-width: 720px;
}

.paper.plain .content {
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.75;
  white-space: pre-wrap;
  max-width: 720px;
}

.paper.raw-prose .content {
  font-family: var(--mono);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  max-width: 820px;
  overflow-wrap: anywhere;
}

.paper.code .content,
.paper.raw-code .content {
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  padding: 0 20px 0 14px;
}

.image-box {
  display: flex;
  justify-content: center;
  padding: 30px;
  background: repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface) 0 50%) 0 0 / 22px 22px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.image-box img {
  max-width: 100%;
  max-height: 70vh;
  image-rendering: auto;
  border-radius: 6px;
}

.panel {
  border-left: 1px solid var(--border);
  background: var(--bg);
  overflow: auto;
  padding: 14px 14px 60px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.hint {
  text-align: center;
  font-size: 14px;
  padding: 20px 14px;
  line-height: 1.5;
}

.toggle-resolved {
  align-self: center;
  margin-top: 6px;
}

.bubble {
  position: fixed;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--text);
  border-radius: 999px;
  box-shadow: var(--shadow);
  z-index: 50;
}

.bubble button {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fbf4e6;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.bubble button:hover {
  background: rgba(255, 255, 255, 0.14);
}

@media (max-width: 1100px) {
  .body {
    grid-template-columns: 1fr;
  }

  .panel {
    border-left: 0;
    border-top: 1px solid var(--border);
  }
}
</style>
