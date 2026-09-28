import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import { toHtml } from 'hast-util-to-html'
import { createLowlight, common } from 'lowlight'
import python from 'highlight.js/lib/languages/python'
import { resolvePath } from '../../shared/files.js'

const GDSCRIPT_KEYWORDS = [
  'extends', 'class_name', 'func', 'var', 'const', 'signal', 'enum', 'static', 'await', 'match', 'when',
  'preload', 'load', 'self', 'super', 'void', 'breakpoint', 'setget', 'onready', 'export', 'tool',
]

const lowlight = createLowlight(common)
lowlight.register('gdscript', (hljs) => {
  const lang = python(hljs)
  lang.keywords = { ...lang.keywords, keyword: [...lang.keywords.keyword, ...GDSCRIPT_KEYWORDS] }
  lang.contains = [...lang.contains, { className: 'meta', begin: /@\w+/ }, { className: 'variable', begin: /\$[\w/]+/ }]
  return lang
})

const HLJS = { shell: 'bash', toml: 'ini', html: 'xml', dockerfile: 'bash' }
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype)

const ENTITY = /^&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i

function align(value, source, start, end) {
  const runs = []
  let run = null
  let j = start
  for (let i = 0; i < value.length; i++) {
    const entity = source[j] === '&' ? source.slice(j, end).match(ENTITY) : null
    if (entity) {
      runs.push({ value: value[i], offset: j })
      run = null
      j += entity[0].length
      continue
    }
    if (source[j] === '\\' && source[j + 1] === value[i]) {
      j++
      run = null
    }
    if (j >= end || source[j] !== value[i]) return null
    if (run) run.value += value[i]
    else runs.push((run = { value: value[i], offset: j }))
    j++
  }
  return runs
}

function locateText(node, source, scope) {
  const { value } = node
  const pos = node.position
  if (pos?.start?.offset != null) {
    const s = pos.start.offset
    const e = pos.end.offset
    if (source.slice(s, e) === value) return [{ value, offset: s }]
    const idx = source.indexOf(value, s)
    if (idx !== -1 && idx < e) return [{ value, offset: idx }]
    return align(value, source, s, e) ?? [{ value, offset: s }]
  }
  if (!scope || !value.trim()) return null
  const idx = source.indexOf(value, scope.cursor)
  if (idx === -1 || idx >= scope.end) return null
  scope.cursor = idx + value.length
  return [{ value, offset: idx }]
}

function mapMarkdown(node, source, scope) {
  const pos = node.position
  const inner = pos?.start?.offset != null ? { cursor: pos.start.offset, end: pos.end.offset } : scope
  if (!node.children) return
  node.children = node.children.flatMap((child) => {
    if (child.type !== 'text') {
      mapMarkdown(child, source, inner)
      return [child]
    }
    const runs = locateText(child, source, inner)
    if (!runs) return [child]
    return runs.map((run) => ({ type: 'text', value: run.value, offset: run.offset }))
  })
}

function mapSequential(node, state) {
  if (node.type === 'text') {
    node.offset = state.cursor
    state.cursor += node.value.length
    return
  }
  for (const child of node.children ?? []) mapSequential(child, state)
}

const SAFE_PROTOCOL = /^(https?:|mailto:|#)/i

function isExternal(url) {
  return /^([a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)
}

function rewriteLinks(node, path) {
  if (node.type === 'element') {
    const props = node.properties
    if (node.tagName === 'img' && props.src && isExternal(props.src) && !/^(https?:|data:image\/)/i.test(props.src)) {
      delete props.src
    } else if (node.tagName === 'img' && props.src && !isExternal(props.src)) {
      props.src = `/api/raw?path=${encodeURIComponent(resolvePath(path, decodeURI(props.src)))}`
      props.loading = 'lazy'
    }
    if (node.tagName === 'a' && props.href) {
      if (isExternal(props.href)) {
        if (!SAFE_PROTOCOL.test(props.href)) {
          delete props.href
        } else if (!props.href.startsWith('#')) {
          props.target = '_blank'
          props.rel = 'noopener noreferrer'
        }
      } else {
        const target = resolvePath(path, decodeURI(props.href.split('#')[0]))
        props.href = `/file/${target}`
        props.dataInternal = target
      }
    }
  }
  for (const child of node.children ?? []) rewriteLinks(child, path)
}

export function markdownTree(source, path) {
  const tree = processor.runSync(processor.parse(source))
  mapMarkdown(tree, source, { cursor: 0, end: source.length })
  rewriteLinks(tree, path)
  return tree
}

export function codeTree(source, lang) {
  const name = HLJS[lang] ?? lang
  const tree =
    name && lowlight.registered(name)
      ? lowlight.highlight(name, source)
      : { type: 'root', children: [{ type: 'text', value: source }] }
  mapSequential(tree, { cursor: 0 })
  return tree
}

export function plainTree(source) {
  return { type: 'root', children: [{ type: 'text', value: source, offset: 0 }] }
}

function segment(node, ranges) {
  const start = node.offset
  const end = start + node.value.length
  const cuts = new Set([start, end])
  for (const r of ranges) {
    if (r.start > start && r.start < end) cuts.add(r.start)
    if (r.end > start && r.end < end) cuts.add(r.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const pieces = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const covering = ranges.filter((r) => r.start < b && r.end > a)
    const properties = { dataO: String(a) }
    if (covering.length) {
      properties.dataT = covering.map((r) => r.id).join(' ')
      properties.className = ['hl', ...new Set(covering.map((r) => `hl-${r.tone}`))]
    }
    pieces.push({
      type: 'element',
      tagName: 'span',
      properties,
      children: [{ type: 'text', value: node.value.slice(a - start, b - start) }],
    })
  }
  return pieces
}

function decorate(node, ranges) {
  if (!node.children) return
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && child.offset != null && child.value) return segment(child, ranges)
    decorate(child, ranges)
    return [child]
  })
}

export function renderHtml(tree, ranges) {
  const copy = structuredClone(tree)
  decorate(copy, ranges)
  return toHtml(copy)
}

function textLength(node) {
  return node.nodeType === Node.TEXT_NODE ? node.length : node.textContent.length
}

function leafOffset(root, node, offset) {
  if (node.nodeType === Node.TEXT_NODE) {
    const span = node.parentElement?.closest('[data-o]')
    if (span && root.contains(span)) return Number(span.dataset.o) + Math.min(offset, node.length)
    return null
  }
  const children = [...node.childNodes]
  const after = children[offset]
  if (after) {
    const el = after.nodeType === Node.ELEMENT_NODE ? after : after.parentElement
    const first = after.nodeType === Node.ELEMENT_NODE && after.matches('[data-o]') ? after : el?.querySelector('[data-o]')
    if (first && root.contains(first)) return Number(first.dataset.o)
  }
  const before = children[offset - 1]
  if (before && before.nodeType === Node.ELEMENT_NODE) {
    const spans = before.matches('[data-o]') ? [before] : [...before.querySelectorAll('[data-o]')]
    const last = spans.at(-1)
    if (last) return Number(last.dataset.o) + textLength(last)
  }
  return null
}

function textNodes(range) {
  const common = range.commonAncestorContainer
  if (common.nodeType === Node.TEXT_NODE) return [common]
  const nodes = []
  const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) if (range.intersectsNode(walker.currentNode)) nodes.push(walker.currentNode)
  return nodes
}

function firstLine(range) {
  let line = null
  for (const node of textNodes(range)) {
    const part = document.createRange()
    part.selectNodeContents(node)
    if (node === range.startContainer) part.setStart(node, range.startOffset)
    if (node === range.endContainer) part.setEnd(node, range.endOffset)
    for (const rect of part.getClientRects()) {
      if (!rect.width) continue
      if (!line) line = { top: rect.top, bottom: rect.bottom, right: rect.right }
      else if (rect.top + rect.height / 2 < line.bottom) line.right = Math.max(line.right, rect.right)
      else return line
    }
  }
  return line
}

export function selectionRange(root) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const start = leafOffset(root, range.startContainer, range.startOffset)
  const end = leafOffset(root, range.endContainer, range.endOffset)
  if (start === null || end === null || end <= start) return null
  const line = firstLine(range)
  return line && { start, end, line }
}
