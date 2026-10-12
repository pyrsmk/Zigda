<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { editorLanguage } from '../lib/languages.js'

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
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-3)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-scroller': { overflow: 'auto' },
})

const proseTheme = EditorView.theme({
  '.cm-content': { fontFamily: 'var(--serif)', fontSize: '16px', lineHeight: '1.7', maxWidth: '800px', padding: '24px 32px' },
  '.cm-gutters': { display: 'none' },
})

const highlight = HighlightStyle.define([
  { tag: [tags.heading], fontWeight: '800', color: 'var(--syn-heading)' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strong], fontWeight: '800' },
  { tag: [tags.keyword, tags.bool, tags.null], color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--syn-string)' },
  { tag: [tags.number], color: 'var(--syn-number)' },
  { tag: [tags.comment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName, tags.variableName], color: 'var(--syn-attr)' },
  { tag: [tags.function(tags.variableName), tags.className], color: 'var(--syn-title)' },
  { tag: [tags.link, tags.url], color: 'var(--syn-attr)', textDecoration: 'underline' },
  { tag: [tags.quote], color: 'var(--text-dim)', fontStyle: 'italic' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--text-faint)' },
])

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
