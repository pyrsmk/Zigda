<script setup>
import { ICONS } from '../lib/icons.js'

defineProps({ name: String, size: { type: Number, default: 16 } })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path :d="ICONS[name]" />
  </svg>
</template>

<style scoped>
.icon {
  flex-shrink: 0;
}
</style>
