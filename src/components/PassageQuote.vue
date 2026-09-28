<script setup>
defineProps({ anchor: Object, code: Boolean, orphan: Boolean })
</script>

<template>
  <blockquote class="passage" :class="{ code, orphan }">{{ anchor.quote }}</blockquote>
</template>

<style scoped>
.passage {
  margin: 10px 0 4px;
  padding: 3px 10px;
  border-left: 3px solid var(--hl-strong);
  color: var(--text-dim);
  font-family: var(--serif);
  font-size: 14px;
  max-height: 4.8em;
  overflow: hidden;
  white-space: pre-wrap;
}

.passage.code {
  font-family: var(--mono);
  font-size: 12.5px;
  tab-size: 4;
}

.passage.orphan {
  text-decoration: line-through;
}
</style>
