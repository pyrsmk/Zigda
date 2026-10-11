<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import { compact } from '../lib/viewport.js'
import Button from './Button.vue'
import Card from './Card.vue'
import PassageQuote from './PassageQuote.vue'

const props = defineProps({ draft: Object, path: String, sha: String, prose: Boolean })
const emit = defineEmits(['cancel', 'created'])

const text = ref('')
const busy = ref(false)
const error = ref('')
const form = ref(null)
const quoteOpen = ref(false)

const ready = computed(() => Boolean(text.value.trim()))

async function focus() {
  await nextTick()
  form.value?.$el.querySelector('textarea')?.focus()
}

watch(
  () => props.draft,
  () => {
    text.value = ''
    error.value = ''
    quoteOpen.value = false
    focus()
  },
  { immediate: true },
)

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
    :class="{ writing: compact }"
    @submit.prevent="submit"
  >
    <PassageQuote
      :anchor="draft.anchor"
      :code="!prose"
      class="quote"
      :class="{ open: quoteOpen }"
      @click="quoteOpen = !quoteOpen"
    />
    <textarea
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
        icon="message"
        :icon-size="14"
        :disabled="busy || !ready"
      >
        Post
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

.quote {
  margin: 2px 0;
  border-left-color: var(--accent);
  max-height: 6em;
  overflow: auto;
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
