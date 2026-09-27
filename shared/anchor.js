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

export function locate(text, anchor) {
  if (!anchor?.quote) return null
  const { quote, prefix = '', suffix = '' } = anchor
  let best = null
  let bestScore = -Infinity
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
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

export function replaceAt(text, anchor, replacement) {
  const place = locate(text, anchor)
  if (!place) return null
  return text.slice(0, place.start) + replacement + text.slice(place.end)
}
