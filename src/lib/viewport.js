import { ref } from 'vue'

function tracked(query) {
  const list = window.matchMedia(query)
  const state = ref(list.matches)
  list.addEventListener('change', (event) => (state.value = event.matches))
  return state
}

export const compact = tracked('(max-width: 760px)')
export const touch = tracked('(pointer: coarse)')
