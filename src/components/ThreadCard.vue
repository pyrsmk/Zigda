<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { displayName, refreshOverview, session } from '../session.js'
import { SYSTEM_EVENTS, ago, eventLabel, fullDate, isOpen } from '../lib/format.js'
import { compact } from '../lib/viewport.js'
import Avatar from './Avatar.vue'
import Button from './Button.vue'
import Card from './Card.vue'
import PassageQuote from './PassageQuote.vue'
import VersionCard from './VersionCard.vue'

const props = defineProps({
  thread: Object,
  active: Boolean,
  orphan: Boolean,
  compact: Boolean,
  prose: { type: Boolean, default: true },
})
const emit = defineEmits(['updated', 'applied', 'select'])

const reply = ref('')
const busy = ref(false)
const error = ref('')
const proposing = ref(false)
const wording = ref('')
const replying = ref(false)

const passage = computed(() => props.thread.kind === 'passage')
const versions = computed(() => props.thread.proposals)
const openVersions = computed(() => versions.value.filter(isOpen))
const expanded = computed(() => !props.compact || props.active)
const timeline = computed(() => {
  const ids = new Set(versions.value.map((p) => p.id))
  const announced = (m) => m.kind === 'event' && m.body.startsWith('proposed@') && ids.has(m.body.split('@')[1])
  return [
    ...versions.value.map((p) => ({ key: `v${p.id}`, at: p.created_at, version: p })),
    ...props.thread.messages
      .filter((m) => m !== first.value && !announced(m))
      .map((m) => ({ key: `m${m.id}`, at: m.created_at, message: m })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))
})
const numbered = computed(() => passage.value && versions.value.length > 1)
const quote = computed(() => props.thread.anchor?.quote ?? '')
const canPropose = computed(
  () =>
    passage.value &&
    props.thread.status === 'open' &&
    !openVersions.value.some((p) => p.author?.id === session.user.id),
)
const applied = computed(() => versions.value.some((p) => p.status === 'applied'))
const first = computed(() => {
  const message = props.thread.messages[0]
  const opening =
    message?.kind === 'text' &&
    message.author?.id === props.thread.author?.id &&
    new Date(message.created_at) - new Date(props.thread.created_at) < 5000
  return opening ? message : null
})

async function run(action) {
  busy.value = true
  error.value = ''
  try {
    const thread = await action()
    const before = versions.value.filter((p) => p.status === 'applied').length
    if (thread?.proposals.filter((p) => p.status === 'applied').length > before) emit('applied')
    if (thread) emit('updated', thread)
    refreshOverview()
    return true
  } catch (err) {
    error.value = err.message
    const fresh = await (passage.value ? api.threads(props.thread.path) : api.proposals({ path: props.thread.path })).catch(
      () => null,
    )
    const updated = fresh?.find((t) => t.id === props.thread.id)
    if (updated) emit('updated', updated)
    if (err.status === 409) emit('applied')
    return false
  } finally {
    busy.value = false
  }
}

async function send() {
  const text = reply.value.trim()
  if (!text) return
  if (await run(() => api.reply(props.thread.id, text))) {
    reply.value = ''
    replying.value = false
  }
}

const setStatus = (status) => run(() => api.setThreadStatus(props.thread.id, status))

function startProposing() {
  wording.value = openVersions.value.at(-1)?.content ?? quote.value
  proposing.value = true
}

async function propose() {
  if (await run(() => api.addVersion(props.thread.id, { content: wording.value }))) proposing.value = false
}

function number(p) {
  return numbered.value ? versions.value.indexOf(p) + 1 : null
}
</script>

<template>
  <Card
    as="article"
    class="thread"
    :class="{ active, resolved: thread.status === 'resolved', proposing: openVersions.length, code: !prose }"
    @click="emit('select', thread.id)"
  >
    <header>
      <Avatar :user="thread.author" :size="24" />
      <strong>{{ displayName(thread.author) }}</strong>
      <span class="faint when" :title="fullDate(thread.created_at)">{{ ago(thread.created_at) }}</span>
      <span v-if="passage && thread.status === 'resolved'" class="badge resolved">Closed</span>
    </header>

    <PassageQuote v-if="passage" :anchor="thread.anchor" :code="!prose" :orphan="orphan && !applied" />
    <p v-if="orphan && !applied" class="faint orphan-note">This passage has since been changed and no longer appears in the text.</p>

    <p v-if="first && expanded" class="body first">{{ first.body }}</p>

    <div v-if="expanded" class="messages">
      <template v-for="item in timeline" :key="item.key">
        <VersionCard
          v-if="item.version"
          :proposal="item.version"
          :number="number(item.version)"
          :before="quote"
          :prose="prose"
          :diff="passage"
          :actions="active"
          :busy="busy"
          :run="run"
        />
        <p v-else-if="item.message.kind === 'event' && SYSTEM_EVENTS[item.message.body]" class="event">
          {{ SYSTEM_EVENTS[item.message.body] }}
          <span class="faint">· {{ ago(item.message.created_at) }}</span>
        </p>
        <p v-else-if="item.message.kind === 'event'" class="event">
          <strong>{{ displayName(item.message.author) }}</strong> {{ eventLabel(item.message.body, versions) }}
          <span class="faint">· {{ ago(item.message.created_at) }}</span>
        </p>
        <div v-else class="message">
          <div class="message-head">
            <Avatar :user="item.message.author" :size="20" />
            <strong>{{ displayName(item.message.author) }}</strong>
            <span class="faint when" :title="fullDate(item.message.created_at)">{{ ago(item.message.created_at) }}</span>
          </div>
          <p class="body">{{ item.message.body }}</p>
        </div>
      </template>
    </div>
    <template v-else>
      <VersionCard
        v-for="p in openVersions"
        :key="p.id"
        :proposal="p"
        :number="number(p)"
        :before="quote"
        :prose="prose"
        :diff="passage"
        :actions="active"
        :busy="busy"
        :run="run"
      />
      <p v-if="versions.length > openVersions.length" class="faint more">
        {{ versions.length - openVersions.length }} closed version{{ versions.length - openVersions.length > 1 ? 's' : '' }}
      </p>
      <p v-if="thread.messages.length > 1" class="faint more">{{ thread.messages.length }} messages</p>
    </template>

    <div v-if="error" class="error small">{{ error }}</div>

    <footer v-if="active" @click.stop>
      <form v-if="proposing" class="propose" :class="{ writing: compact }" @submit.prevent="propose">
        <label class="faint">Replace with</label>
        <textarea v-model="wording" rows="4" class="wording writing-field"></textarea>
        <div class="row-actions writing-bar">
          <Button type="button" variant="ghost" small :flush="compact" @click="proposing = false">Cancel</Button>
          <Button variant="primary" small icon="sparkle" :icon-size="14" :disabled="busy || wording === quote">
            Propose
          </Button>
        </div>
      </form>
      <Button
        v-else-if="canPropose"
        small
        class="propose-button"
        icon="pencil"
        :icon-size="14"
        :disabled="busy"
        @click="startProposing"
      >
        {{ versions.length ? 'Propose another version' : 'Modify' }}
      </Button>
      <form class="reply" :class="{ writing: compact && replying }" @submit.prevent="send">
        <textarea
          v-model="reply"
          rows="2"
          class="writing-field"
          placeholder="Reply…"
          @focus="replying = true"
          @keydown.enter.meta.prevent="send"
          @keydown.enter.ctrl.prevent="send"
        ></textarea>
        <div class="row-actions writing-bar">
          <Button v-if="compact && replying" type="button" variant="ghost" small flush @click="replying = false">
            Cancel
          </Button>
          <template v-else-if="passage">
            <Button
              v-if="thread.status === 'open' && !openVersions.length"
              type="button"
              variant="ghost"
              small
              icon="check"
              :icon-size="14"
              :disabled="busy"
              @click="setStatus('resolved')"
            >
              Close
            </Button>
            <Button
              v-else-if="thread.status === 'resolved' && !applied"
              type="button"
              variant="ghost"
              small
              :disabled="busy"
              @click="setStatus('open')"
            >
              Reopen
            </Button>
          </template>
          <Button variant="primary" small :disabled="busy || !reply.trim()">Send</Button>
        </div>
      </form>
    </footer>
  </Card>
</template>

<style scoped>
.thread {
  padding: 13px 14px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: none;
}

.thread:hover {
  border-color: var(--border-strong);
}

.thread.active {
  border-color: var(--accent);
  box-shadow: var(--shadow);
  cursor: default;
}

.thread.resolved:not(.active) {
  opacity: 0.7;
}

header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
}

.when {
  font-size: 12px;
}

header .badge {
  margin-left: auto;
}

.orphan-note {
  font-size: 13px;
  margin: 6px 0 0;
}

.error.small {
  font-size: 13px;
  margin: 8px 0 0;
  padding: 7px 10px;
}

.messages {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.body {
  margin: 3px 0 0;
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 14px;
}

.body.first {
  margin-top: 8px;
}

.event {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-dim);
  padding: 5px 9px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

.more {
  font-size: 12px;
  margin: 6px 0 0;
}

footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.propose-button {
  align-self: flex-start;
}

.propose {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.propose label {
  font-size: 12px;
  font-weight: 700;
}

.wording {
  font-family: var(--serif);
}

.code .wording {
  font-family: var(--mono);
  font-size: 13px;
  tab-size: 4;
}

.reply textarea,
.propose textarea {
  font-size: 14px;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
</style>
