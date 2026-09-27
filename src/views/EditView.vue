<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import { hasConflictMarkers, mergeText } from '../../shared/merge.js'
import { isProse, language } from '../../shared/files.js'
import CodeEditor from '../components/CodeEditor.vue'
import DiffView from '../components/DiffView.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ path: String })
const route = useRoute()
const router = useRouter()

const creating = route.query.new === '1'
const proposalId = route.query.proposal ?? null

const loading = ref(true)
const error = ref('')
const original = ref('')
const text = ref('')
const baseSha = ref(null)
const title = ref('')
const message = ref('')
const busy = ref(false)
const preview = ref(false)
const mergedWithConflicts = ref(false)

const prose = computed(() => isProse(props.path))
const lang = computed(() => language(props.path))
const conflicts = computed(() => hasConflictMarkers(text.value))
const changed = computed(() => text.value !== original.value)

async function load() {
  try {
    if (proposalId) {
      const thread = await api.proposal(proposalId)
      const p = thread.proposal
      title.value = p.title ?? ''
      if (p.action === 'create') {
        original.value = ''
        text.value = p.content
      } else {
        const current = await api.file(props.path)
        const merged = current.sha === p.base_sha ? { ok: true, text: p.content } : mergeText(p.base_content, current.content, p.content)
        original.value = current.content
        text.value = merged.text
        baseSha.value = current.sha
        mergedWithConflicts.value = !merged.ok
      }
    } else if (!creating) {
      const file = await api.file(props.path)
      if (file.binary) throw new Error('This file cannot be edited here.')
      original.value = file.content
      text.value = file.content
      baseSha.value = file.sha
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

load()

async function submit() {
  busy.value = true
  error.value = ''
  try {
    let id = proposalId
    if (proposalId) {
      await api.revise(proposalId, { content: text.value, baseSha: baseSha.value, title: title.value })
    } else {
      ;({ id } = await api.propose({
        path: props.path,
        action: creating ? 'create' : 'edit',
        baseSha: baseSha.value,
        content: text.value,
        title: title.value,
        body: message.value,
      }))
    }
    refreshOverview()
    router.push({ name: 'proposal', params: { id } })
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

function cancel() {
  if (proposalId) router.push({ name: 'proposal', params: { id: proposalId } })
  else if (creating) router.push({ name: 'home' })
  else router.push({ name: 'file', params: { path: props.path.split('/') } })
}
</script>

<template>
  <div class="edit-view">
    <header class="edit-head">
      <button class="btn ghost small" @click="cancel"><Icon name="back" :size="15" /> Back</button>
      <div class="title">
        <span class="faint">{{ creating ? 'New file' : proposalId ? 'Rework the proposal' : 'Edit' }}</span>
        <strong>{{ path }}</strong>
      </div>
      <div class="segmented">
        <button :class="{ active: !preview }" @click="preview = false"><Icon name="pencil" :size="13" /> Write</button>
        <button :class="{ active: preview }" @click="preview = true"><Icon name="eye" :size="13" /> Changes</button>
      </div>
    </header>

    <div v-if="mergedWithConflicts && conflicts" class="notice banner">
      The file was changed in the same place as you in the meantime. The affected passages are outlined in red:
      keep the right version (or a mix of both), then delete the marker lines before proposing.
    </div>

    <div class="workspace">
      <div class="editor-area">
        <div v-if="loading" class="spinner"></div>
        <template v-else-if="!error || text || creating">
          <CodeEditor v-show="!preview" v-model="text" :language="lang" :prose="prose" />
          <div v-if="preview" class="preview">
            <p v-if="!changed" class="empty">No changes yet.</p>
            <DiffView v-else :before="original" :after="text" :prose="prose" />
          </div>
        </template>
      </div>
      <aside class="submit card">
        <h3>Propose these changes</h3>
        <p class="faint small">
          Nothing is written to the repository until every other team member has approved.
        </p>
        <label>Summary</label>
        <input v-model="title" :placeholder="creating ? `Creation of ${path.split('/').pop()}` : 'E.g. Rewrite of the wake-up scene'" />
        <template v-if="!proposalId">
          <label>Message for the team (optional)</label>
          <textarea v-model="message" rows="4" placeholder="What you changed and why…"></textarea>
        </template>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="conflicts" class="notice small">Some conflicting passages still need to be resolved.</div>
        <button
          class="btn primary"
          :disabled="busy || loading || conflicts || (!changed && !proposalId) || (creating && !text)"
          @click="submit"
        >
          <Icon name="sparkle" :size="15" />
          {{ proposalId ? 'Update the proposal' : 'Propose' }}
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.edit-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.edit-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
}

.title {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  min-width: 0;
}

.title strong {
  font-size: 16px;
  overflow-wrap: anywhere;
}

.edit-head .segmented {
  margin-left: auto;
}

.segmented button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.banner {
  margin: 12px 24px 0;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  padding: 18px 24px 24px;
  min-height: 0;
}

.editor-area {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow);
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-area > :deep(.editor) {
  flex: 1;
}

.preview {
  overflow: auto;
  padding: 22px 26px;
  flex: 1;
}

.submit {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
}

.submit h3 {
  margin: 0;
  font-size: 16px;
}

.small {
  font-size: 13px;
  margin: 0 0 6px;
  line-height: 1.45;
}

label {
  font-size: 13px;
  font-weight: 700;
  margin-top: 4px;
}

.submit .btn.primary {
  justify-content: center;
  margin-top: 6px;
}

@media (max-width: 1000px) {
  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(400px, 1fr) auto;
  }
}
</style>
