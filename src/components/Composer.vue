<script setup>
import { nextTick, ref, watch } from 'vue'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import Icon from './Icon.vue'

const props = defineProps({ draft: Object, path: String, sha: String, prose: Boolean })
const emit = defineEmits(['cancel', 'created'])

const text = ref('')
const replacement = ref('')
const busy = ref(false)
const error = ref('')
const form = ref(null)

async function focus() {
  await nextTick()
  form.value?.querySelector('textarea')?.focus()
}

watch(
  () => props.draft,
  (draft) => {
    text.value = ''
    replacement.value = draft?.anchor.quote ?? ''
    error.value = ''
    focus()
  },
  { immediate: true },
)

watch(() => props.draft?.kind, focus)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const thread = await api.createThread({
      path: props.path,
      kind: props.draft.kind,
      anchor: props.draft.anchor,
      baseSha: props.sha,
      body: text.value,
      replacement: props.draft.kind === 'suggestion' ? replacement.value : undefined,
    })
    refreshOverview()
    emit('created', thread)
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form ref="form" class="composer card" :class="{ code: !prose }" @submit.prevent="submit">
    <div class="segmented">
      <button type="button" :class="{ active: draft.kind === 'comment' }" @click="draft.kind = 'comment'">
        Comment
      </button>
      <button type="button" :class="{ active: draft.kind === 'suggestion' }" @click="draft.kind = 'suggestion'">
        Suggest a change
      </button>
    </div>
    <blockquote class="quote">{{ draft.anchor.quote }}</blockquote>
    <template v-if="draft.kind === 'suggestion'">
      <label class="faint">Replace with</label>
      <textarea v-model="replacement" rows="4" class="replacement"></textarea>
      <label class="faint">Explanation (optional)</label>
      <textarea v-model="text" rows="2" placeholder="Why this change?"></textarea>
    </template>
    <textarea
      v-else
      v-model="text"
      rows="3"
      placeholder="Your comment…"
     
      @keydown.enter.meta.prevent="submit"
      @keydown.enter.ctrl.prevent="submit"
    ></textarea>
    <div v-if="error" class="error">{{ error }}</div>
    <div class="actions">
      <button type="button" class="btn ghost small" @click="emit('cancel')">Cancel</button>
      <button
        class="btn primary small"
        :disabled="busy || (draft.kind === 'comment' ? !text.trim() : replacement === draft.anchor.quote)"
      >
        <Icon :name="draft.kind === 'comment' ? 'message' : 'sparkle'" :size="14" />
        {{ draft.kind === 'comment' ? 'Post' : 'Propose' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px;
  border-color: var(--accent);
}

.segmented {
  align-self: flex-start;
}

.quote {
  margin: 2px 0;
  padding: 3px 10px;
  border-left: 3px solid var(--accent);
  color: var(--text-dim);
  font-family: var(--serif);
  font-size: 14px;
  max-height: 6em;
  overflow: auto;
  white-space: pre-wrap;
}

label {
  font-size: 12px;
  font-weight: 700;
}

.replacement {
  font-family: var(--serif);
}

.code .quote,
.code .replacement {
  font-family: var(--mono);
  font-size: 13px;
  tab-size: 4;
}

textarea {
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
