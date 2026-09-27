import { StreamLanguage } from '@codemirror/language'

const LEGACY = {
  shell: () => import('@codemirror/legacy-modes/mode/shell').then((m) => m.shell),
  toml: () => import('@codemirror/legacy-modes/mode/toml').then((m) => m.toml),
  ini: () => import('@codemirror/legacy-modes/mode/properties').then((m) => m.properties),
  ruby: () => import('@codemirror/legacy-modes/mode/ruby').then((m) => m.ruby),
  lua: () => import('@codemirror/legacy-modes/mode/lua').then((m) => m.lua),
  csharp: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.csharp),
  c: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.c),
  cpp: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.cpp),
  java: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.java),
  kotlin: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.kotlin),
  rust: () => import('@codemirror/legacy-modes/mode/rust').then((m) => m.rust),
  go: () => import('@codemirror/legacy-modes/mode/go').then((m) => m.go),
  swift: () => import('@codemirror/legacy-modes/mode/swift').then((m) => m.swift),
  sql: () => import('@codemirror/legacy-modes/mode/sql').then((m) => m.standardSQL),
  dockerfile: () => import('@codemirror/legacy-modes/mode/dockerfile').then((m) => m.dockerFile),
  makefile: () => import('@codemirror/legacy-modes/mode/shell').then((m) => m.shell),
  php: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.php ?? m.c),
  scss: () => import('@codemirror/legacy-modes/mode/css').then((m) => m.sCSS),
  less: () => import('@codemirror/legacy-modes/mode/css').then((m) => m.less),
}

const MODERN = {
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  python: () => import('@codemirror/lang-python').then((m) => m.python()),
  gdscript: () => import('@codemirror/lang-python').then((m) => m.python()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  xml: () => import('@codemirror/lang-html').then((m) => m.html()),
}

export async function editorLanguage(lang) {
  if (MODERN[lang]) return MODERN[lang]()
  if (LEGACY[lang]) return StreamLanguage.define(await LEGACY[lang]())
  return []
}
