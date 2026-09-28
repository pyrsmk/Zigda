const CONTEXT = 40

export function makeAnchor(text, start, end) {
  return {
    start,
    end,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  }
}

function commonSuffix(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

function commonPrefix(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

function occurrences(text, needle) {
  const found = []
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) found.push(i)
  return found
}

export function locate(text, anchor) {
  if (!anchor) return null
  const { quote, prefix = '', suffix = '' } = anchor
  const starts = occurrences(text, quote)
  let best = null
  let bestScore = -Infinity
  for (const i of starts) {
    const before = text.slice(Math.max(0, i - prefix.length), i)
    const after = text.slice(i + quote.length, i + quote.length + suffix.length)
    const distance = Math.abs(i - anchor.start) / (text.length + 1)
    const score = commonSuffix(before, prefix) + commonPrefix(after, suffix) - distance
    if (score > bestScore) {
      bestScore = score
      best = { start: i, end: i + quote.length }
    }
  }
  return best
}

export function overlaps(a, b) {
  return a.start < b.end && b.start < a.end
}
