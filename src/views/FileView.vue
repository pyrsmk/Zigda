<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { refreshOverview, repoChanged, session, displayName } from '../session.js'
import { codeTree, markdownTree, plainTree, renderHtml, selectionRange } from '../lib/render.js'
import { ago, isOpen } from '../lib/format.js'
import { makeAnchor, locate, overlaps } from '../../shared/anchor.js'
import { imageType, isMarkdown, isProse, language } from '../../shared/files.js'
import ThreadCard from '../components/ThreadCard.vue'
import Composer from '../components/Composer.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import Icon from '../components/Icon.vue'
import Avatar from '../components/Avatar.vue'
import Button from '../components/Button.vue'
import Segmented from '../components/Segmented.vue'
import { compact, touch } from '../lib/viewport.js'

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
const bubbleEl = ref(null)
const panel = ref('threads')
const showResolved = ref(false)
const content = ref(null)
const contentArea = ref(null)
const confirmDelete = ref(false)
const deleting = ref(false)
const sheetOpen = ref(false)

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

const byPlace = (a, b) => (a.range?.start ?? Infinity) - (b.range?.start ?? Infinity)
const byDate = (a, b) => new Date(b.thread.created_at) - new Date(a.thread.created_at)

const visible = computed(() =>
  placed.value
    .filter(({ thread }) => showResolved.value || thread.status === 'open')
    .sort(compact.value ? byDate : byPlace),
)

const resolvedCount = computed(() => threads.value.filter((t) => t.status === 'resolved').length)
const openCount = computed(() => threads.value.filter((t) => t.status === 'open').length)

const html = computed(() => {
  if (!tree.value) return ''
  const ranges = visible.value
    .filter(({ range }) => range)
    .map(({ thread, range }) => ({
      ...range,
      id: thread.id,
      tone: thread.id === activeId.value ? 'active' : thread.proposals.some(isOpen) ? 'suggestion' : 'passage',
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
  sheetOpen.value = false
  await Promise.all([loadFile(), loadThreads()])
  loading.value = false
  const wanted = route.query.discussion
  if (wanted && threads.value.some((t) => t.id === wanted)) {
    showResolved.value = threads.value.find((t) => t.id === wanted).status === 'resolved' || showResolved.value
    await nextTick()
    select(wanted, false)
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
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(settle)
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocumentMouseDown)
})

function trimRange(start, end) {
  const value = text.value
  while (start < end && /\s/.test(value[start])) start++
  while (end > start && /\s/.test(value[end - 1])) end--
  return end > start ? { start, end } : null
}

function takenBy(range) {
  return placed.value.find(
    ({ thread, range: other }) => thread.status === 'open' && other && overlaps(other, range),
  )?.thread
}

async function openBubble(range, line) {
  const taken = takenBy(range)?.id ?? null
  if (touch.value) {
    bubble.value = { ...range, taken, docked: true }
    return
  }
  bubble.value = {
    ...range,
    taken,
    top: (line.top + line.bottom) / 2 - 12,
    left: line.right + 6,
  }
  await nextTick()
  const limit = contentArea.value.getBoundingClientRect().right - 8
  const width = bubbleEl.value.offsetWidth
  if (bubble.value.left + width > limit) {
    bubble.value.left = Math.min(line.right, limit) - width
    bubble.value.top = line.top - 28
  }
}

function captureSelection() {
  const sel = content.value && selectionRange(content.value)
  if (!sel) return
  const range = trimRange(sel.start, sel.end)
  if (!range) return
  openBubble(range, sel.line)
}

let settle
function onSelectionChange() {
  clearTimeout(settle)
  if (window.getSelection()?.isCollapsed) {
    if (bubble.value?.docked) settle = setTimeout(() => (bubble.value = null), 300)
    else bubble.value = null
    return
  }
  if (touch.value) settle = setTimeout(captureSelection, 300)
}

function onContentScroll() {
  if (!bubble.value?.docked) bubble.value = null
}

function onDocumentMouseDown(event) {
  if (bubble.value && !event.target.closest('.bubble')) bubble.value = null
}

function openTaken() {
  const id = bubble.value.taken
  bubble.value = null
  window.getSelection()?.removeAllRanges()
  select(id)
}

function startDraft(kind, { start, end }) {
  draft.value = { kind, range: { start, end }, anchor: makeAnchor(text.value, start, end) }
  bubble.value = null
  activeId.value = null
  panel.value = 'threads'
  sheetOpen.value = true
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

async function select(id, reveal = true) {
  activeId.value = id
  panel.value = 'threads'
  if (reveal) sheetOpen.value = true
  await nextTick()
  document.getElementById(`thread-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const mark = content.value?.querySelector(`[data-t~="${id}"]`)
  mark?.scrollIntoView({ behavior: 'smooth', block: compact.value && sheetOpen.value ? 'start' : 'center' })
}

function cancelDraft() {
  draft.value = null
  if (compact.value) sheetOpen.value = false
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
        <Segmented
          v-if="text !== null"
          v-model="mode"
          :options="[
            { value: 'formatted', label: 'Formatted', icon: 'eye' },
            { value: 'raw', label: 'Raw text', icon: 'code' },
          ]"
        />
        <Button
          v-if="file"
          variant="ghost"
          small
          title="Propose deletion"
          icon="trash"
          @click="confirmDelete = !confirmDelete"
        />
      </div>
    </header>

    <div v-if="confirmDelete" class="notice confirm">
      Propose deleting this file? It will only take effect once every other team member has approved.
      <div class="confirm-actions">
        <Button variant="ghost" small @click="confirmDelete = false">Cancel</Button>
        <Button variant="danger" small :disabled="deleting" @click="proposeDelete">Propose deletion</Button>
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

    <div class="body" :class="{ single: text === null }">
      <section ref="contentArea" class="content-area" @scroll="onContentScroll">
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
            @mouseup="captureSelection"
            @click="onContentClick"
            v-html="html"
          ></div>
        </div>
      </section>

      <aside v-if="text !== null" class="panel" :class="{ open: sheetOpen }">
        <div class="panel-tabs">
          <Segmented
            v-model="panel"
            :options="[
              { value: 'threads', label: 'Discussions', icon: 'message' },
              { value: 'history', label: 'History', icon: 'history' },
            ]"
          />
          <Button variant="ghost" small class="sheet-close" title="Close" icon="x" @click="sheetOpen = false" />
        </div>
        <template v-if="panel === 'threads'">
          <Composer
            v-if="draft"
            :draft="draft"
            :path="path"
            :sha="file.sha"
            :prose="prose"
            @cancel="cancelDraft"
            @created="onCreated"
          />
          <p v-if="!visible.length && !draft" class="hint faint">
            Select a passage of the text to comment on it or modify it.
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
          <Button v-if="resolvedCount" variant="ghost" small class="toggle-resolved" @click="showResolved = !showResolved">
            {{ showResolved ? 'Hide' : 'Show' }} closed discussions ({{ resolvedCount }})
          </Button>
        </template>
        <HistoryPanel v-else :path="path" :sha="file?.sha" />
      </aside>
    </div>

    <Button
      v-if="text !== null && !sheetOpen && !bubble"
      variant="primary"
      class="sheet-toggle"
      icon="message"
      @click="sheetOpen = true"
    >
      Discussions
      <span v-if="openCount" class="sheet-count">{{ openCount }}</span>
    </Button>

    <Teleport to="body">
      <div
        v-if="bubble"
        ref="bubbleEl"
        class="bubble"
        :class="{ docked: bubble.docked }"
        :style="bubble.docked ? null : { top: `${bubble.top}px`, left: `${bubble.left}px` }"
        @mousedown.prevent
      >
        <button v-if="bubble.taken" @click="openTaken">
          <Icon name="message" :size="12" /> Already under discussion: open it
        </button>
        <template v-else>
          <button @click="startDraft('comment', bubble)">
            <Icon name="message" :size="12" /> Comment
          </button>
          <button @click="startDraft('version', bubble)">
            <Icon name="pencil" :size="12" /> Modify
          </button>
        </template>
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

.sheet-close,
.sheet-toggle {
  display: none;
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

.body.single {
  grid-template-columns: minmax(0, 1fr);
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
  position: relative;
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
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--text);
  border-radius: 999px;
  box-shadow: var(--shadow);
  z-index: 50;
}

.bubble button {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  color: #fbf4e6;
  padding: 0 9px 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
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

@media (max-width: 760px) {
  .file-head {
    padding: 10px 14px;
    gap: 8px;
    flex-wrap: nowrap;
  }

  .crumbs {
    flex: 1;
    font-size: 14px;
  }

  .crumbs .last {
    font-size: 16px;
  }

  .tools {
    gap: 4px;
  }

  .file-head :deep(.label) {
    display: none;
  }

  .confirm {
    margin: 10px 14px 0;
  }

  .pending-list {
    padding: 10px 14px 0;
  }

  .pending > .faint {
    display: none;
  }

  .content-area {
    padding: 12px 10px 90px;
  }

  .paper.markdown,
  .paper.plain,
  .paper.raw-prose {
    padding: 20px 18px;
  }

  .paper.plain .content {
    font-size: 16px;
  }

  .image-box {
    padding: 14px;
  }

  .panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: -65dvh;
    height: 65dvh;
    z-index: 30;
    padding: 10px 12px calc(40px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border-strong);
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: 0 -6px 24px rgba(80, 60, 30, 0.15);
    visibility: hidden;
    transition: bottom 0.2s, visibility 0s 0.2s;
  }

  .panel.open {
    bottom: 0;
    visibility: visible;
    transition: bottom 0.2s;
  }

  .panel-tabs {
    position: sticky;
    top: -10px;
    z-index: 1;
    margin: -10px -12px 4px;
    padding: 10px 12px 6px;
    background: var(--bg);
  }

  .sheet-close {
    display: inline-flex;
    position: absolute;
    top: 10px;
    right: 8px;
  }

  .sheet-toggle {
    display: inline-flex;
    position: fixed;
    right: 14px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 20;
    box-shadow: var(--shadow);
  }
}

.sheet-count {
  background: #fffaf2;
  color: var(--accent-text);
  border-radius: 999px;
  min-width: 20px;
  padding: 0 6px;
  font-size: 12px;
  text-align: center;
}

.bubble.docked {
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  padding: 4px;
}

.bubble.docked button {
  height: 40px;
  padding: 0 16px 0 12px;
  font-size: 14px;
}
</style>
