<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { refreshOverview } from '../session.js'
import { isProse, language } from '../../shared/files.js'
import CodeEditor from '../components/CodeEditor.vue'
import Button from '../components/Button.vue'
import Card from '../components/Card.vue'

const props = defineProps({ path: String })
const route = useRoute()
const router = useRouter()

const proposalId = route.query.proposal ?? null

const loading = ref(Boolean(proposalId))
const error = ref('')
const text = ref('')
const title = ref('')
const message = ref('')
const busy = ref(false)

const prose = computed(() => isProse(props.path))
const lang = computed(() => language(props.path))

async function load() {
  try {
    const thread = await api.proposal(proposalId)
    title.value = thread.proposal.title ?? ''
    text.value = thread.proposal.content
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

if (proposalId) load()

async function submit() {
  busy.value = true
  error.value = ''
  try {
    let id = proposalId
    if (proposalId) {
      await api.revise(proposalId, { content: text.value, title: title.value })
    } else {
      ;({ id } = await api.propose({
        path: props.path,
        action: 'create',
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
  else router.push({ name: 'home' })
}
</script>

<template>
  <div class="edit-view">
    <header class="edit-head">
      <Button variant="ghost" small icon="back" @click="cancel">Back</Button>
      <div class="title">
        <span class="faint">{{ proposalId ? 'Rework the new file' : 'New file' }}</span>
        <strong>{{ path }}</strong>
      </div>
    </header>

    <div class="workspace">
      <div class="editor-area">
        <div v-if="loading" class="spinner"></div>
        <CodeEditor v-else-if="!error || text" v-model="text" :language="lang" :prose="prose" />
      </div>
      <Card as="aside" class="submit">
        <h3>Propose this new file</h3>
        <p class="faint small">
          Nothing is written to the repository until every other team member has approved.
        </p>
        <label>Summary</label>
        <input v-model="title" :placeholder="`Creation of ${path.split('/').pop()}`" />
        <template v-if="!proposalId">
          <label>Message for the team (optional)</label>
          <textarea v-model="message" rows="4" placeholder="What this file is for…"></textarea>
        </template>
        <div v-if="error" class="error">{{ error }}</div>
        <Button variant="primary" icon="sparkle" :disabled="busy || loading || !text" @click="submit">
          {{ proposalId ? 'Update the proposal' : 'Propose' }}
        </Button>
      </Card>
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

@media (max-width: 760px) {
  .edit-view {
    height: auto;
    min-height: 100%;
  }

  .edit-head {
    padding: 10px 14px;
    gap: 10px;
  }

  .workspace {
    grid-template-rows: auto auto;
    gap: 14px;
    padding: 12px 10px 24px;
  }

  .editor-area {
    height: 55dvh;
  }

  .submit {
    padding: 16px;
  }
}
</style>
