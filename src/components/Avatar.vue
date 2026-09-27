<script setup>
import { computed } from 'vue'
import { displayName } from '../session.js'

const props = defineProps({ user: Object, size: { type: Number, default: 26 } })
const initial = computed(() => displayName(props.user).charAt(0).toUpperCase())
</script>

<template>
  <img
    v-if="user?.avatar_url"
    :src="user.avatar_url"
    :alt="displayName(user)"
    :title="displayName(user)"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="avatar"
  />
  <span v-else class="avatar fallback" :style="{ width: `${size}px`, height: `${size}px` }">{{ initial }}</span>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--surface-3);
}

.fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  color: var(--text-dim);
}
</style>
