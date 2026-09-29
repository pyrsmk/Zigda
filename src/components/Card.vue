<script setup>
import { RouterLink } from 'vue-router'

defineProps({ as: { type: String, default: 'div' }, to: [String, Object] })
</script>

<template>
  <component :is="to ? RouterLink : as" :to="to" class="card"><slot /></component>
</template>

<style>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
</style>
