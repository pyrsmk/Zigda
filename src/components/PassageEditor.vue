<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import CodeEditor from './CodeEditor.vue'
import Button from './Button.vue'

const props = defineProps({
  anchor: Object,
  lockId: String,
  path: String,
  sha: String,
  language: String,
  prose: Boolean,
})
const emit = defineEmits(['cancel', 'created'])

const text = ref(props.anchor.quote)
const busy = ref(false)
const error = ref('')
const root = ref(null)

onMounted(() => root.value.querySelector('.cm-content')?.focus())

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const thread = await api.createThread({
      path: props.path,
      anchor: props.anchor,
      baseSha: props.sha,
      replacement: text.value,
      lockId: props.lockId,
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
  <div ref="root" class="passage-editor">
    <CodeEditor v-model="text" :language="language" :prose="prose" />
    <div v-if="error" class="error">{{ error }}</div>
    <div class="actions">
      <Button variant="ghost" small @click="emit('cancel')">Cancel</Button>
      <Button variant="primary" small icon="sparkle" :icon-size="14" :disabled="busy || text === anchor.quote" @click="submit">
        Propose
      </Button>
    </div>
  </div>
</template>

<style scoped>
.passage-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
  white-space: normal;
  overflow: hidden;
}

.error {
  margin: 8px 10px 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}
</style>
