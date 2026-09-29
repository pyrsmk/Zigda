<script setup>
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

defineProps({
  variant: String,
  small: Boolean,
  flush: Boolean,
  icon: String,
  iconSize: { type: Number, default: 15 },
  href: String,
  to: [String, Object],
})
</script>

<template>
  <component
    :is="to ? RouterLink : href ? 'a' : 'button'"
    :to="to"
    :href="href"
    class="btn"
    :class="[variant, { small, flush }]"
  >
    <Icon v-if="icon" :name="icon" :size="iconSize" />
    <slot />
  </component>
</template>

<style>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: background 0.15s, transform 0.1s;
  white-space: nowrap;
  text-decoration: none;
  color: var(--text);
}

.btn:hover:not(:disabled) {
  background: var(--surface-3);
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fffaf2;
}

.btn.primary:hover:not(:disabled) {
  background: #4246b0;
}

.btn.ok {
  background: var(--ok);
  border-color: var(--ok);
  color: #fbfff5;
}

.btn.ok:hover:not(:disabled) {
  background: #527a42;
}

.btn.danger {
  background: var(--danger-soft);
  border-color: transparent;
  color: var(--danger);
}

.btn.ghost {
  background: transparent;
  border-color: transparent;
}

.btn.ghost:hover:not(:disabled) {
  background: var(--surface-2);
}

.btn.small {
  padding: 5px 11px;
  font-size: 13px;
}

.btn.flush {
  padding-left: 0;
}

.btn.ghost.flush:hover:not(:disabled) {
  background: transparent;
}

@media (pointer: coarse) {
  .btn.small {
    padding: 8px 13px;
  }
}
</style>
