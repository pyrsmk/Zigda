<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { Decoration, MatchDecorator, ViewPlugin, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { editorLanguage } from '../lib/languages.js'
import { MARKERS } from '../../shared/merge.js'

const props = defineProps({
  modelValue: String,
  language: String,
  prose: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
let view
const languageSlot = new Compartment()

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)', height: '100%', fontSize: '14px' },
  '.cm-content': { fontFamily: 'var(--mono)', padding: '14px 0', caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--text-faint)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(79, 82, 196, 0.05)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-3)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-conflict': { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: '700' },
})

const proseTheme = EditorView.theme({
  '.cm-content': { fontFamily: 'var(--serif)', fontSize: '16px', lineHeight: '1.7', maxWidth: '800px', padding: '24px 32px' },
  '.cm-gutters': { display: 'none' },
})

const highlight = HighlightStyle.define([
  { tag: [tags.heading], fontWeight: '800', color: '#9c4a27' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strong], fontWeight: '800' },
  { tag: [tags.keyword, tags.bool, tags.null], color: '#b0522c', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: '#5f7f3a' },
  { tag: [tags.number], color: '#a0632a' },
  { tag: [tags.comment], color: '#9b8b72', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName, tags.variableName], color: '#36718a' },
  { tag: [tags.function(tags.variableName), tags.className], color: '#7b4f9a' },
  { tag: [tags.link, tags.url], color: '#36718a', textDecoration: 'underline' },
  { tag: [tags.quote], color: '#7d6d58', fontStyle: 'italic' },
  { tag: [tags.meta, tags.processingInstruction], color: '#a6957c' },
])

const conflictMatcher = new MatchDecorator({
  regexp: new RegExp(`^(${Object.values(MARKERS).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'gm'),
  decoration: Decoration.mark({ class: 'cm-conflict' }),
})

const conflicts = ViewPlugin.define((v) => ({
  decorations: conflictMatcher.createDeco(v),
  update(u) {
    this.decorations = conflictMatcher.updateDeco(u, this.decorations)
  },
}), { decorations: (p) => p.decorations })

onMounted(async () => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue ?? '',
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        theme,
        syntaxHighlighting(highlight),
        conflicts,
        props.prose ? [EditorView.lineWrapping, Prec.highest(proseTheme)] : [],
        languageSlot.of([]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  view.dispatch({ effects: languageSlot.reconfigure(await editorLanguage(props.language)) })
})

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value ?? '' } })
    }
  },
)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="editor"></div>
</template>

<style scoped>
.editor {
  height: 100%;
  min-height: 0;
}

.editor :deep(.cm-editor) {
  height: 100%;
}
</style>
