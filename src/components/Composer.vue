<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import Icon from './Icon.vue'
import PassageQuote from './PassageQuote.vue'

const props = defineProps({ draft: Object, path: String, sha: String, prose: Boolean })
const emit = defineEmits(['cancel', 'created'])

const text = ref('')
const replacement = ref('')
const busy = ref(false)
const error = ref('')
const form = ref(null)

const proposing = computed(() => props.draft.kind === 'version')
const ready = computed(() =>
  proposing.value ? replacement.value !== props.draft.anchor.quote : Boolean(text.value.trim()),
)

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
  if (!ready.value) return
  busy.value = true
  error.value = ''
  try {
    const thread = await api.createThread({
      path: props.path,
      anchor: props.draft.anchor,
      baseSha: props.sha,
      body: text.value,
      replacement: proposing.value ? replacement.value : undefined,
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
      <button type="button" :class="{ active: !proposing }" @click="draft.kind = 'comment'">Comment</button>
      <button type="button" :class="{ active: proposing }" @click="draft.kind = 'version'">
        Modify
      </button>
    </div>
    <PassageQuote :anchor="draft.anchor" :code="!prose" class="quote" />
    <template v-if="proposing">
      <label class="faint">Replace with</label>
      <textarea v-model="replacement" rows="4" class="replacement"></textarea>
      <label class="faint">Explanation (optional)</label>
      <textarea v-model="text" rows="2" placeholder="Why this change?"></textarea>
    </template>
    <textarea
      v-else
      v-model="text"
      rows="3"
      placeholder="Your comment or question…"
      @keydown.enter.meta.prevent="submit"
      @keydown.enter.ctrl.prevent="submit"
    ></textarea>
    <div v-if="error" class="error">{{ error }}</div>
    <div class="actions">
      <button type="button" class="btn ghost small" @click="emit('cancel')">Cancel</button>
      <button class="btn primary small" :disabled="busy || !ready">
        <Icon :name="proposing ? 'sparkle' : 'message'" :size="14" />
        {{ proposing ? 'Propose' : 'Post' }}
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
  border-left-color: var(--accent);
  max-height: 6em;
  overflow: auto;
}

label {
  font-size: 12px;
  font-weight: 700;
}

.replacement {
  font-family: var(--serif);
}

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
