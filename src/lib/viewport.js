import { ref } from 'vue'

function tracked(query) {
  const list = window.matchMedia(query)
  const state = ref(list.matches)
  list.addEventListener('change', (event) => (state.value = event.matches))
  return state
}

export const compact = tracked('(max-width: 760px)')
export const touch = tracked('(pointer: coarse)')

const view = window.visualViewport
function fit() {
  document.documentElement.style.setProperty('--view-top', `${view.offsetTop}px`)
  document.documentElement.style.setProperty('--view-height', `${view.height}px`)
}
view.addEventListener('resize', fit)
view.addEventListener('scroll', fit)
fit()
