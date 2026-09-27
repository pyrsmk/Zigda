import { diff3Merge } from 'node-diff3'

export const MARKERS = {
  start: '<<<<<<< Current version in the repository',
  middle: '======= Your proposal',
  end: '>>>>>>> End of conflict',
}

export function mergeText(base, current, proposed) {
  if (current === base) return { ok: true, text: proposed }
  if (proposed === base || proposed === current) return { ok: true, text: current }
  const regions = diff3Merge(current.split('\n'), base.split('\n'), proposed.split('\n'), {
    excludeFalseConflicts: true,
  })
  const lines = []
  let ok = true
  for (const region of regions) {
    if (region.ok) {
      lines.push(...region.ok)
    } else {
      ok = false
      lines.push(MARKERS.start, ...region.conflict.a, MARKERS.middle, ...region.conflict.b, MARKERS.end)
    }
  }
  return { ok, text: lines.join('\n') }
}

export function hasConflictMarkers(text) {
  return text.split('\n').some((line) => line === MARKERS.start || line === MARKERS.middle || line === MARKERS.end)
}
