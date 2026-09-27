<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { displayName, refreshOverview, session } from '../session.js'
import { ago, eventLabel, fullDate, STATUS, CONFLICTS } from '../lib/format.js'
import Avatar from './Avatar.vue'
import DiffView from './DiffView.vue'
import Icon from './Icon.vue'

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
const editing = ref(false)
const replacement = ref('')

const proposal = computed(() => props.thread.proposal)
const mine = computed(() => proposal.value?.author?.id === session.user.id)
const openProposal = computed(() => ['pending', 'conflict'].includes(proposal.value?.status))
const approvedByMe = computed(() => proposal.value?.approved_by.some((u) => u.id === session.user.id))
const expectedCount = computed(() => (proposal.value ? proposal.value.approved_by.length + proposal.value.waiting_for.length : 0))
const first = computed(() => props.thread.messages[0])

async function run(action) {
  busy.value = true
  error.value = ''
  try {
    const thread = await action()
    if (thread?.proposal?.status === 'applied' && proposal.value?.status !== 'applied') emit('applied')
    if (thread) emit('updated', thread)
    refreshOverview()
    return true
  } catch (err) {
    error.value = err.message
    const fresh = await api.threads(props.thread.path).catch(() => null)
    const updated = fresh?.find((t) => t.id === props.thread.id)
    if (updated) emit('updated', updated)
    return false
  } finally {
    busy.value = false
  }
}

async function send() {
  const text = reply.value.trim()
  if (!text) return
  if (await run(() => api.reply(props.thread.id, text))) reply.value = ''
}

const setStatus = (status) => run(() => api.setThreadStatus(props.thread.id, status))

const decide = (action) => run(() => api.decide(proposal.value.id, action))

function startEdit() {
  replacement.value = proposal.value.content
  editing.value = true
}

async function saveEdit() {
  if (await run(() => api.revise(proposal.value.id, { content: replacement.value }))) editing.value = false
}
</script>

<template>
  <article
    class="thread card"
    :class="{ active, resolved: thread.status === 'resolved', suggestion: thread.kind === 'suggestion', code: !prose }"
    @click="emit('select', thread.id)"
  >
    <header>
      <Avatar :user="thread.author" :size="24" />
      <strong>{{ displayName(thread.author) }}</strong>
      <span class="faint when" :title="fullDate(thread.created_at)">{{ ago(thread.created_at) }}</span>
      <span v-if="proposal" class="badge" :class="proposal.status">{{ STATUS[proposal.status] }}</span>
      <span v-else-if="thread.status === 'resolved'" class="badge resolved">Resolved</span>
    </header>

    <blockquote v-if="thread.kind === 'comment' && thread.anchor" class="quote" :class="{ orphan }">
      {{ thread.anchor.quote }}
    </blockquote>
    <div v-if="thread.kind === 'suggestion'" class="suggestion-body">
      <div class="label"><Icon name="sparkle" :size="13" /> Suggests replacing</div>
      <div v-if="!editing" class="diff-box">
        <DiffView :before="thread.anchor.quote" :after="proposal.content" prose :class="{ mono: !prose }" />
      </div>
      <div v-else class="edit-box" @click.stop>
        <textarea v-model="replacement" rows="4"></textarea>
        <div class="row-actions">
          <button class="btn ghost small" @click="editing = false">Cancel</button>
          <button class="btn primary small" :disabled="busy" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
    <p v-if="orphan" class="faint orphan-note">This passage has since been changed and no longer appears in the text.</p>
    <p v-if="proposal?.status === 'conflict'" class="notice small">{{ CONFLICTS[proposal.error] }}</p>

    <div v-if="proposal && openProposal && expectedCount" class="approvals">
      <span class="approvals-count">
        {{ proposal.approved_by.length }}/{{ expectedCount }} approval{{ expectedCount > 1 ? 's' : '' }}
      </span>
      <span class="people">
        <span v-for="u in proposal.approved_by" :key="u.id" class="person done" :title="`${displayName(u)} approved`">
          <Avatar :user="u" :size="22" />
          <Icon name="check" :size="11" class="tick" />
        </span>
        <span v-for="u in proposal.waiting_for" :key="u.id" class="person" :title="`Waiting for ${displayName(u)}`">
          <Avatar :user="u" :size="22" />
        </span>
      </span>
    </div>

    <div v-if="!compact || active" class="messages">
      <template v-for="message in thread.messages" :key="message.id">
        <p v-if="message.kind === 'event'" class="event">
          <strong>{{ displayName(message.author) }}</strong> {{ eventLabel(message.body) }}
          <span class="faint">· {{ ago(message.created_at) }}</span>
        </p>
        <div v-else class="message" :class="{ first: message === first }">
          <div v-if="message !== first" class="message-head">
            <Avatar :user="message.author" :size="20" />
            <strong>{{ displayName(message.author) }}</strong>
            <span class="faint when" :title="fullDate(message.created_at)">{{ ago(message.created_at) }}</span>
          </div>
          <p class="body">{{ message.body }}</p>
        </div>
      </template>
    </div>
    <p v-else-if="thread.messages.length > 1" class="faint more">{{ thread.messages.length }} messages</p>

    <div v-if="error" class="error small">{{ error }}</div>

    <footer v-if="active" @click.stop>
      <div v-if="proposal && openProposal" class="decision">
        <template v-if="!mine">
          <span v-if="approvedByMe" class="badge applied"><Icon name="check" :size="12" /> You approved</span>
          <button
            v-else
            class="btn ok small"
            :disabled="busy || proposal.status === 'conflict'"
            @click="decide('approve')"
          >
            <Icon name="check" :size="14" /> Approve
          </button>
          <button class="btn danger small" :disabled="busy" @click="decide('reject')">Reject</button>
        </template>
        <template v-else>
          <RouterLink
            v-if="thread.kind === 'proposal' && proposal.action !== 'delete'"
            :to="{ name: 'edit', params: { path: proposal.path.split('/') }, query: { proposal: proposal.id } }"
            class="btn small"
          >
            <Icon name="pencil" :size="14" /> {{ proposal.status === 'conflict' ? 'Rework' : 'Edit' }}
          </RouterLink>
          <button v-else-if="thread.kind === 'suggestion' && !editing" class="btn small" :disabled="busy" @click="startEdit">
            <Icon name="pencil" :size="14" /> Edit
          </button>
          <button class="btn ghost small" :disabled="busy" @click="decide('withdraw')">Withdraw</button>
        </template>
      </div>
      <form class="reply" @submit.prevent="send">
        <textarea
          v-model="reply"
          rows="2"
          placeholder="Reply…"
          @keydown.enter.meta.prevent="send"
          @keydown.enter.ctrl.prevent="send"
        ></textarea>
        <div class="row-actions">
          <template v-if="thread.kind === 'comment'">
            <button
              v-if="thread.status === 'open'"
              type="button"
              class="btn ghost small"
              :disabled="busy"
              @click="setStatus('resolved')"
            >
              <Icon name="check" :size="14" /> Resolve
            </button>
            <button v-else type="button" class="btn ghost small" :disabled="busy" @click="setStatus('open')">
              Reopen
            </button>
          </template>
          <button class="btn primary small" :disabled="busy || !reply.trim()">Send</button>
        </div>
      </form>
    </footer>
  </article>
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

.quote {
  margin: 10px 0 4px;
  padding: 3px 10px;
  border-left: 3px solid var(--hl-strong);
  color: var(--text-dim);
  font-family: var(--serif);
  font-size: 14px;
  max-height: 4.8em;
  overflow: hidden;
  white-space: pre-wrap;
}

.quote.orphan {
  text-decoration: line-through;
}

.suggestion-body {
  margin-top: 10px;
}

.label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  color: #5b7d3f;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 5px;
}

.code .quote,
.diff-box .mono,
.code .edit-box textarea {
  font-family: var(--mono);
  font-size: 12.5px;
  tab-size: 4;
}

.diff-box {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 11px;
}

.diff-box :deep(.words) {
  font-size: 15px;
}

.orphan-note {
  font-size: 13px;
  margin: 6px 0 0;
}

.notice.small,
.error.small {
  font-size: 13px;
  margin: 8px 0 0;
  padding: 7px 10px;
}

.approvals {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 7px 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

.approvals-count {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-dim);
}

.people {
  display: flex;
  gap: 4px;
}

.person {
  position: relative;
  display: flex;
  opacity: 0.45;
  filter: grayscale(1);
}

.person.done {
  opacity: 1;
  filter: none;
}

.tick {
  position: absolute;
  right: -3px;
  bottom: -3px;
  background: var(--ok);
  color: #fff;
  border-radius: 50%;
  padding: 1px;
}

.decision .badge {
  align-self: center;
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

.message.first .body {
  margin-top: 0;
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.decision {
  display: flex;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border);
}

.reply textarea,
.edit-box textarea {
  font-size: 14px;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
</style>
