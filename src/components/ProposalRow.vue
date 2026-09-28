<script setup>
import { computed } from 'vue'
import { displayName, session } from '../session.js'
import { ACTIONS, STATUS, ago, awaitsMe, isOpen, proposalTitle } from '../lib/format.js'
import Avatar from './Avatar.vue'

const props = defineProps({ thread: Object })
const passage = computed(() => props.thread.kind === 'passage')
const versions = computed(() => props.thread.proposals)
const open = computed(() => versions.value.filter(isOpen))
const p = computed(() => open.value.at(-1) ?? versions.value.at(-1))
const toReview = computed(() => versions.value.some((v) => awaitsMe(v, session.user)))
const summary = computed(() => {
  if (!passage.value) return proposalTitle(p.value)
  return `“${props.thread.anchor.quote.slice(0, 80)}” → “${p.value.content.slice(0, 80)}”`
})
const kind = computed(() => ACTIONS[p.value.action])
const target = computed(() =>
  passage.value
    ? { name: 'file', params: { path: props.thread.path.split('/') }, query: { discussion: props.thread.id } }
    : { name: 'proposal', params: { id: p.value.id } },
)
const replies = computed(() => props.thread.messages.filter((m) => m.kind === 'text').length)
const updated = computed(() => new Date(Math.max(...versions.value.map((v) => new Date(v.updated_at)))))
</script>

<template>
  <RouterLink :to="target" class="row card" :class="{ review: toReview }">
    <Avatar :user="p.author" :size="34" />
    <div class="text">
      <div class="line">
        <strong class="summary">{{ summary }}</strong>
      </div>
      <div class="meta faint">
        <span class="kind">{{ kind }}</span> · {{ thread.path }} · {{ displayName(p.author) }} ·
        {{ ago(updated) }}
        <template v-if="versions.length > 1"> · {{ versions.length }} versions</template>
        <template v-if="replies"> · {{ replies }} message{{ replies > 1 ? 's' : '' }}</template>
      </div>
    </div>
    <span v-if="toReview" class="badge count">To review</span>
    <span v-if="open.length > 1" class="badge pending">{{ open.length }} versions pending</span>
    <template v-else>
      <span v-if="p.status === 'pending'" class="faint progress">
        {{ p.approved_by.length }}/{{ p.approved_by.length + p.waiting_for.length }} approval{{ p.approved_by.length + p.waiting_for.length > 1 ? 's' : '' }}
      </span>
      <span class="badge" :class="p.status">{{ STATUS[p.status] }}</span>
    </template>
  </RouterLink>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  text-decoration: none;
  color: var(--text);
  box-shadow: none;
  transition: border-color 0.15s, transform 0.1s;
}

.row:hover {
  border-color: var(--border-strong);
}

.row.review {
  border-color: var(--accent-soft);
  background: #fffaf3;
}

.text {
  flex: 1;
  min-width: 0;
}

.summary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.kind {
  font-weight: 700;
}
</style>
