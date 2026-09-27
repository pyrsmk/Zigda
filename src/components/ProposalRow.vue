<script setup>
import { computed } from 'vue'
import { displayName, session } from '../session.js'
import { ACTIONS, STATUS, ago, awaitsMe, proposalTitle } from '../lib/format.js'
import Avatar from './Avatar.vue'

const props = defineProps({ thread: Object })
const p = computed(() => props.thread.proposal)
const toReview = computed(() => awaitsMe(p.value, session.user))
const summary = computed(() => {
  if (!p.value.title && p.value.action === 'replace') {
    return `“${props.thread.anchor.quote.slice(0, 80)}” → “${p.value.content.slice(0, 80)}”`
  }
  return proposalTitle(p.value)
})
const target = computed(() =>
  props.thread.kind === 'suggestion'
    ? { name: 'file', params: { path: props.thread.path.split('/') }, query: { discussion: props.thread.id } }
    : { name: 'proposal', params: { id: p.value.id } },
)
const replies = computed(() => props.thread.messages.filter((m) => m.kind === 'text').length)
</script>

<template>
  <RouterLink :to="target" class="row card" :class="{ review: toReview }">
    <Avatar :user="p.author" :size="34" />
    <div class="text">
      <div class="line">
        <strong class="summary">{{ summary }}</strong>
      </div>
      <div class="meta faint">
        <span class="kind">{{ ACTIONS[p.action] }}</span> · {{ p.path }} · {{ displayName(p.author) }} ·
        {{ ago(p.updated_at) }}
        <template v-if="replies"> · {{ replies }} message{{ replies > 1 ? 's' : '' }}</template>
      </div>
    </div>
    <span v-if="toReview" class="badge count">To review</span>
    <span v-if="p.status === 'pending'" class="faint progress">
      {{ p.approved_by.length }}/{{ p.approved_by.length + p.waiting_for.length }} approval{{ p.approved_by.length + p.waiting_for.length > 1 ? 's' : '' }}
    </span>
    <span class="badge" :class="p.status">{{ STATUS[p.status] }}</span>
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
