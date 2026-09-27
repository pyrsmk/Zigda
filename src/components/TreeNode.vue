<script setup>
import { computed } from 'vue'
import { imageType, isProse } from '../../shared/files.js'
import Icon from './Icon.vue'

const props = defineProps({
  node: Object,
  depth: Number,
  expanded: Object,
  current: String,
  activity: Object,
})
defineEmits(['toggle'])

const isFolder = computed(() => props.node.type === 'tree')
const open = computed(() => props.expanded.has(props.node.path))
const icon = computed(() => {
  if (isFolder.value) return open.value ? 'folder-open' : 'folder'
  if (imageType(props.node.path)) return 'image'
  return isProse(props.node.path) ? 'file' : 'code'
})

const counts = computed(() => {
  let comments = 0
  let proposals = 0
  const prefix = `${props.node.path}/`
  for (const [path, value] of Object.entries(props.activity ?? {})) {
    if (path === props.node.path || (isFolder.value && path.startsWith(prefix))) {
      comments += value.comments
      proposals += value.proposals
    }
  }
  return { comments, proposals }
})
</script>

<template>
  <div>
    <button
      v-if="isFolder"
      class="row"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="$emit('toggle', node.path)"
    >
      <Icon name="chevron" :size="13" class="chevron" :class="{ open }" />
      <Icon :name="icon" :size="16" class="kind folder" />
      <span class="name">{{ node.name }}</span>
      <span v-if="!open && (counts.comments || counts.proposals)" class="dot" :class="{ proposal: counts.proposals }"></span>
    </button>
    <RouterLink
      v-else
      :to="{ name: 'file', params: { path: node.path.split('/') } }"
      class="row"
      :class="{ active: node.path === current }"
      :style="{ paddingLeft: `${21 + depth * 14}px` }"
    >
      <Icon :name="icon" :size="16" class="kind" />
      <span class="name">{{ node.name }}</span>
      <span v-if="counts.proposals" class="pill proposal" title="Pending proposals">{{ counts.proposals }}</span>
      <span v-if="counts.comments" class="pill" title="Open discussions">{{ counts.comments }}</span>
    </RouterLink>
    <template v-if="isFolder && open">
      <TreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :current="current"
        :activity="activity"
        @toggle="$emit('toggle', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  text-align: left;
  text-decoration: none;
  color: var(--text);
  font-size: 14px;
}

.row:hover {
  background: var(--surface-3);
}

.row.active {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}

.chevron {
  color: var(--text-faint);
  transition: transform 0.15s;
}

.chevron.open {
  transform: rotate(90deg);
}

.kind {
  color: var(--text-faint);
}

.kind.folder {
  color: #c79a52;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hl-strong);
}

.dot.proposal {
  background: var(--accent);
}

.pill {
  font-size: 11px;
  font-weight: 800;
  min-width: 18px;
  text-align: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--hl);
  color: #7a5812;
}

.pill.proposal {
  background: var(--accent-soft);
  color: var(--accent-text);
}
</style>
