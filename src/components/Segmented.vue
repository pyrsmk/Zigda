<script setup>
import Icon from './Icon.vue'

defineProps({ options: Array, iconSize: { type: Number, default: 13 } })
const model = defineModel()
</script>

<template>
  <div class="segmented">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :class="{ active: model === o.value }"
      @click="model = o.value"
    >
      <Icon v-if="o.icon" :name="o.icon" :size="iconSize" /><span class="label">{{ o.label }}</span>
    </button>
  </div>
</template>

<style>
.segmented {
  display: inline-flex;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
}

.segmented button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dim);
}

.segmented button.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(80, 60, 30, 0.12);
}

@media (pointer: coarse) {
  .segmented button {
    padding: 7px 13px;
  }
}
</style>
