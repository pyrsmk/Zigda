<script setup>
import { computed } from 'vue'
import { diffArrays, diffLines, diffWordsWithSpace } from 'diff'

const props = defineProps({
  before: { type: String, default: '' },
  after: { type: String, default: '' },
  prose: Boolean,
  context: { type: Number, default: 3 },
})

function sentences(text) {
  const out = []
  let start = 0
  for (const match of text.matchAll(/[.!?…]+(?=\s|$)\s*|\n+/g)) {
    const end = match.index + match[0].length
    if (end > start) out.push(text.slice(start, end))
    start = end
  }
  if (start < text.length) out.push(text.slice(start))
  return out
}

function hunks(parts) {
  let count = 0
  let changing = false
  for (const part of parts) {
    if (part.added || part.removed) {
      if (!changing) count++
      changing = true
    } else if (part.value.trim()) {
      changing = false
    }
  }
  return count
}

function group(parts) {
  const out = []
  let hunk = []
  const close = () => {
    const tail = []
    while (hunk.length && !hunk.at(-1).added && !hunk.at(-1).removed) tail.unshift(hunk.pop())
    const removed = hunk.filter((p) => !p.added).map((p) => p.value).join('')
    const added = hunk.filter((p) => !p.removed).map((p) => p.value).join('')
    if (removed) out.push({ removed: true, value: removed })
    if (added) out.push({ added: true, value: added })
    out.push(...tail)
    hunk = []
  }
  for (const part of parts) {
    if (part.added || part.removed || (hunk.length && !part.value.trim())) {
      hunk.push(part)
    } else {
      close()
      out.push(part)
    }
  }
  close()
  return out
}

function refine(removed, added) {
  const parts = diffWordsWithSpace(removed, added)
  if (hunks(parts) <= 1) return group(parts)
  return [
    { removed: true, value: removed },
    { added: true, value: added },
  ]
}

const words = computed(() => {
  if (!props.prose) return []
  const out = []
  let removed = []
  let added = []
  const flush = () => {
    if (removed.length && added.length) {
      if (removed.length === added.length) removed.forEach((sentence, i) => out.push(...refine(sentence, added[i])))
      else out.push(...refine(removed.join(''), added.join('')))
    } else if (removed.length) {
      out.push({ removed: true, value: removed.join('') })
    } else if (added.length) {
      out.push({ added: true, value: added.join('') })
    }
    removed = []
    added = []
  }
  for (const part of diffArrays(sentences(props.before ?? ''), sentences(props.after ?? ''))) {
    if (part.removed) removed.push(...part.value)
    else if (part.added) added.push(...part.value)
    else {
      flush()
      out.push({ value: part.value.join('') })
    }
  }
  flush()
  return out
})

const words_trimmed = computed(() => {
  const parts = words.value
  const out = []
  parts.forEach((part, i) => {
    if (part.added || part.removed) return out.push(part)
    const lines = part.value.split('\n')
    const keep = 2
    if (lines.length <= keep * 2 + 1) return out.push(part)
    const head = i === 0 ? [] : lines.slice(0, keep + 1)
    const tail = i === parts.length - 1 ? [] : lines.slice(-keep - 1)
    if (head.length) out.push({ value: head.join('\n') })
    out.push({ gap: true })
    if (tail.length) out.push({ value: tail.join('\n') })
  })
  return out
})

const rows = computed(() => {
  if (props.prose) return []
  const all = []
  let oldLine = 1
  let newLine = 1
  for (const part of diffLines(props.before ?? '', props.after ?? '')) {
    const lines = part.value.replace(/\n$/, '').split('\n')
    for (const text of lines) {
      if (part.added) all.push({ type: 'add', text, newLine: newLine++ })
      else if (part.removed) all.push({ type: 'del', text, oldLine: oldLine++ })
      else all.push({ type: 'same', text, oldLine: oldLine++, newLine: newLine++ })
    }
  }
  const visible = all.map((row, i) =>
    all.slice(Math.max(0, i - props.context), i + props.context + 1).some((r) => r.type !== 'same'),
  )
  const out = []
  all.forEach((row, i) => {
    if (visible[i]) out.push(row)
    else if (visible[i - 1] || (i === 0 && !visible[0])) out.push({ type: 'gap' })
  })
  return out
})
</script>

<template>
  <div v-if="prose" class="words">
    <template v-for="(part, i) in words_trimmed" :key="i">
      <div v-if="part.gap" class="gap">⋯</div>
      <ins v-else-if="part.added">{{ part.value }}</ins>
      <del v-else-if="part.removed">{{ part.value }}</del>
      <span v-else>{{ part.value }}</span>
    </template>
  </div>
  <div v-else class="lines">
    <template v-for="(row, i) in rows" :key="i">
      <div v-if="row.type === 'gap'" class="row gap">⋯</div>
      <div v-else class="row" :class="row.type">
        <span class="num">{{ row.oldLine ?? '' }}</span>
        <span class="num">{{ row.newLine ?? '' }}</span>
        <span class="sign">{{ row.type === 'add' ? '+' : row.type === 'del' ? '−' : '' }}</span>
        <span class="text">{{ row.text || ' ' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.words {
  white-space: pre-wrap;
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.7;
  word-break: break-word;
}

ins {
  background: var(--ok-soft);
  color: #3f6130;
  text-decoration: none;
  border-radius: 3px;
  padding: 0 1px;
}

del {
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: 3px;
  padding: 0 1px;
}

.gap {
  color: var(--text-faint);
  text-align: center;
  font-family: var(--font);
  margin: 4px 0;
}

.lines {
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
}

.row {
  display: grid;
  grid-template-columns: 44px 44px 20px 1fr;
  min-width: max-content;
}

.row.gap {
  display: block;
  background: var(--surface-2);
  padding: 1px 0;
}

.num {
  color: var(--text-faint);
  text-align: right;
  padding-right: 8px;
  user-select: none;
}

.sign {
  user-select: none;
  text-align: center;
}

.text {
  white-space: pre;
  padding-right: 16px;
}

.row.add {
  background: var(--ok-soft);
}

.row.del {
  background: var(--danger-soft);
}
</style>
