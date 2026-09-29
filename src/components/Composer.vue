<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import { compact } from '../lib/viewport.js'
import Button from './Button.vue'
import Card from './Card.vue'
import Segmented from './Segmented.vue'
import PassageQuote from './PassageQuote.vue'

const props = defineProps({ draft: Object, path: String, sha: String, prose: Boolean })
const emit = defineEmits(['cancel', 'created'])

const text = ref('')
const replacement = ref('')
const busy = ref(false)
const error = ref('')
const form = ref(null)
const quoteOpen = ref(false)

const proposing = computed(() => props.draft.kind === 'version')
const ready = computed(() =>
  proposing.value ? replacement.value !== props.draft.anchor.quote : Boolean(text.value.trim()),
)

async function focus() {
  await nextTick()
  form.value?.$el.querySelector('textarea')?.focus()
}

watch(
  () => props.draft,
  (draft) => {
    text.value = ''
    replacement.value = draft?.anchor.quote ?? ''
    error.value = ''
    quoteOpen.value = false
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
      body: proposing.value ? undefined : text.value,
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
  <Card
    ref="form"
    as="form"
    class="composer"
    :class="{ code: !prose, writing: compact }"
    @submit.prevent="submit"
  >
    <Segmented
      v-model="draft.kind"
      :icon-size="12"
      :options="[
        { value: 'comment', label: 'Comment', icon: compact ? 'message' : null },
        { value: 'version', label: 'Modify', icon: compact ? 'pencil' : null },
      ]"
    />
    <PassageQuote
      :anchor="draft.anchor"
      :code="!prose"
      class="quote"
      :class="{ open: quoteOpen }"
      @click="quoteOpen = !quoteOpen"
    />
    <template v-if="proposing">
      <label class="faint">Replace with</label>
      <textarea v-model="replacement" rows="4" class="replacement writing-field"></textarea>
    </template>
    <textarea
      v-else
      v-model="text"
      class="writing-field"
      rows="3"
      placeholder="Your comment or question…"
      @keydown.enter.meta.prevent="submit"
      @keydown.enter.ctrl.prevent="submit"
    ></textarea>
    <div v-if="error" class="error">{{ error }}</div>
    <div class="actions writing-bar">
      <Button
        type="button"
        variant="ghost"
        small
        :flush="compact"
        :icon="compact ? 'back' : null"
        :icon-size="14"
        @click="emit('cancel')"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        small
        :icon="proposing ? 'sparkle' : 'message'"
        :icon-size="14"
        :disabled="busy || !ready"
      >
        {{ proposing ? 'Propose' : 'Post' }}
      </Button>
    </div>
  </Card>
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

@media (max-width: 760px) {
  .quote {
    flex-shrink: 0;
  }

  .quote.open {
    max-height: none;
  }
}
</style>
