<script setup>
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { displayName } from '../session.js'
import { ago, fullDate } from '../lib/format.js'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

const props = defineProps({ alert: Object })
const emit = defineEmits(['dismissed'])

const busy = ref(false)

const count = computed(() => props.alert.proposals.length)
const lost = computed(() => `${count.value} pending proposal${count.value > 1 ? 's' : ''}`)
const headline = computed(() => {
  const { kind, path, via, quote } = props.alert
  if (kind === 'passage_changed') {
    return `The passage “${quote.slice(0, 80)}” of ${path} was changed directly on GitHub: ${lost.value} could not be applied.`
  }
  const how = via === 'proposal' ? 'was deleted' : 'was deleted directly on GitHub'
  return `${path} ${how}: ${lost.value} ${count.value > 1 ? 'were' : 'was'} lost.`
})
const target = computed(() =>
  props.alert.thread_id
    ? { name: 'file', params: { path: props.alert.path.split('/') }, query: { discussion: props.alert.thread_id } }
    : null,
)

async function dismiss() {
  busy.value = true
  try {
    await api.dismissAlert(props.alert.id)
    emit('dismissed', props.alert.id)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="alert">
    <Icon name="alert" :size="20" class="icon" />
    <div class="text">
      <p class="headline">{{ headline }}</p>
      <ul>
        <li v-for="(p, i) in alert.proposals" :key="i">
          <Avatar :user="p.author" :size="18" />
          <strong>{{ displayName(p.author) }}</strong>
          <span class="excerpt">
            <template v-if="p.quote">“{{ p.quote.slice(0, 60) }}” → </template>“{{ p.content.slice(0, 80) }}”
          </span>
        </li>
      </ul>
      <p class="meta">
        <span :title="fullDate(alert.created_at)">{{ ago(alert.created_at) }}</span>
        <template v-if="target"> · <RouterLink :to="target">See the discussion</RouterLink></template>
      </p>
    </div>
    <button class="btn small" :disabled="busy" @click="dismiss">Ok</button>
  </article>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 16px;
  background: var(--warn-soft);
  border: 1px solid var(--warn);
  border-radius: var(--radius);
  color: #7a5812;
}

.icon {
  margin-top: 1px;
  color: var(--warn);
}

.text {
  flex: 1;
  min-width: 0;
}

.headline {
  margin: 0;
  font-weight: 700;
  font-size: 14px;
  overflow-wrap: anywhere;
}

ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
}

.excerpt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--serif);
}

.meta {
  margin: 6px 0 0;
  font-size: 12.5px;
}

.meta a {
  color: inherit;
  font-weight: 700;
}
</style>
