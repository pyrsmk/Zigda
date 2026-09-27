const IMAGES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
}

const LANGUAGES = {
  md: 'markdown',
  markdown: 'markdown',
  gd: 'gdscript',
  py: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'html',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  godot: 'ini',
  tscn: 'ini',
  tres: 'ini',
  import: 'ini',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  rb: 'ruby',
  lua: 'lua',
  cs: 'csharp',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  php: 'php',
  sql: 'sql',
  glsl: 'c',
  gdshader: 'c',
}

const FILENAMES = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
  runfile: 'ruby',
}

const PROSE = new Set(['md', 'markdown', 'txt', 'text', 'rst', 'adoc', 'org', ''])

export function basename(path) {
  return path.split('/').pop()
}

export function extension(path) {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function imageType(path) {
  return IMAGES[extension(path)] ?? null
}

export function language(path) {
  return LANGUAGES[extension(path)] ?? FILENAMES[basename(path).toLowerCase()] ?? null
}

export function isMarkdown(path) {
  return language(path) === 'markdown'
}

export function isProse(path) {
  return PROSE.has(extension(path)) && !FILENAMES[basename(path).toLowerCase()]
}

export function dirname(path) {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

export function resolvePath(from, target) {
  const parts = target.startsWith('/') ? [] : dirname(from).split('/').filter(Boolean)
  for (const part of target.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}
