<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { displayName, session } from '../session.js'
import { CONFLICTS, DISCARDED, STATUS, isOpen } from '../lib/format.js'
import { compact } from '../lib/viewport.js'
import Avatar from './Avatar.vue'
import DiffView from './DiffView.vue'
import Icon from './Icon.vue'

const props = defineProps({
  proposal: Object,
  number: Number,
  before: String,
  prose: { type: Boolean, default: true },
  diff: { type: Boolean, default: true },
  actions: Boolean,
  busy: Boolean,
  run: Function,
})

const editing = ref(false)
const content = ref('')

const p = computed(() => props.proposal)
const mine = computed(() => p.value.author?.id === session.user.id)
const open = computed(() => isOpen(p.value))
const approvedByMe = computed(() => p.value.approved_by.some((u) => u.id === session.user.id))
const expectedCount = computed(() => p.value.approved_by.length + p.value.waiting_for.length)
const reason = computed(() => {
  if (p.value.status === 'discarded') return DISCARDED[p.value.error]
  if (p.value.status === 'conflict') return CONFLICTS[p.value.error]
  return null
})

const decide = (action) => props.run(() => api.decide(p.value.id, action))

function startEdit() {
  content.value = p.value.content
  editing.value = true
}

async function saveEdit() {
  if (await props.run(() => api.revise(p.value.id, { content: content.value }))) editing.value = false
}
</script>

<template>
  <section class="version" :class="{ closed: !open }">
    <header v-if="number || p.action === 'replace'">
      <span v-if="number" class="number">Version {{ number }}</span>
      <Avatar :user="p.author" :size="18" />
      <span class="author">{{ displayName(p.author) }}</span>
      <span class="badge" :class="p.status">{{ STATUS[p.status] }}</span>
    </header>

    <div v-if="diff && !editing" class="diff-box">
      <DiffView :before="before" :after="p.content ?? ''" prose :class="{ mono: !prose }" />
    </div>
    <div v-else-if="editing" class="edit-box" :class="{ writing: compact }" @click.stop>
      <textarea v-model="content" rows="4" class="writing-field" :class="{ mono: !prose }"></textarea>
      <div class="row-actions writing-bar">
        <button class="btn ghost small" @click="editing = false">Cancel</button>
        <button class="btn primary small" :disabled="busy || content === before" @click="saveEdit">Save</button>
      </div>
    </div>

    <p v-if="reason" class="note faint">{{ reason }}</p>
    <p v-if="open && p.blocked" class="notice small">
      Waiting for {{ p.blocked }} older discussion{{ p.blocked > 1 ? 's' : '' }} on this file to be settled before
      this deletion can be approved.
    </p>

    <div v-if="open && expectedCount" class="approvals">
      <span class="approvals-count">
        {{ p.approved_by.length }}/{{ expectedCount }} approval{{ expectedCount > 1 ? 's' : '' }}
      </span>
      <span class="people">
        <span v-for="u in p.approved_by" :key="u.id" class="person done" :title="`${displayName(u)} approved`">
          <Avatar :user="u" :size="22" />
          <Icon name="check" :size="11" class="tick" />
        </span>
        <span v-for="u in p.waiting_for" :key="u.id" class="person" :title="`Waiting for ${displayName(u)}`">
          <Avatar :user="u" :size="22" />
        </span>
      </span>
    </div>

    <div v-if="actions && open && !editing" class="decision" @click.stop>
      <template v-if="!mine">
        <span v-if="approvedByMe" class="badge applied"><Icon name="check" :size="12" /> You approved</span>
        <button
          v-else
          class="btn ok small"
          :disabled="busy || p.status === 'conflict' || Boolean(p.blocked)"
          @click="decide('approve')"
        >
          <Icon name="check" :size="14" /> Approve
        </button>
        <button class="btn danger small" :disabled="busy" @click="decide('reject')">Reject</button>
      </template>
      <template v-else>
        <RouterLink
          v-if="p.action === 'create'"
          :to="{ name: 'edit', params: { path: p.path.split('/') }, query: { proposal: p.id } }"
          class="btn small"
        >
          <Icon name="pencil" :size="14" /> Edit
        </RouterLink>
        <button v-else-if="p.action === 'replace'" class="btn small" :disabled="busy" @click="startEdit">
          <Icon name="pencil" :size="14" /> Edit
        </button>
        <button class="btn ghost small" :disabled="busy" @click="decide('withdraw')">Withdraw</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.version {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.version.closed {
  opacity: 0.75;
}

header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.number {
  font-size: 12px;
  font-weight: 800;
  color: #5b7d3f;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-right: 2px;
}

.author {
  font-weight: 700;
}

header .badge {
  margin-left: auto;
}

.diff-box {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 11px;
}

.diff-box :deep(.words) {
  font-size: 15px;
}

.mono,
.diff-box .mono {
  font-family: var(--mono);
  font-size: 12.5px;
  tab-size: 4;
}

.edit-box textarea {
  font-size: 14px;
  font-family: var(--serif);
}

.note {
  font-size: 13px;
  margin: 0;
}

.notice.small {
  font-size: 13px;
  margin: 0;
  padding: 7px 10px;
}

.approvals {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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

.decision {
  display: flex;
  gap: 6px;
}

.decision .badge {
  align-self: center;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
</style>
