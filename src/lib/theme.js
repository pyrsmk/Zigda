import { ref, watchEffect } from 'vue'

const BAR = { light: '#fdf9f0', dark: '#312c45' }

const system = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(system.matches)
system.addEventListener('change', (event) => (systemDark.value = event.matches))

export const theme = ref(localStorage.getItem('theme') ?? 'auto')

watchEffect(() => {
  const root = document.documentElement
  if (theme.value === 'auto') {
    delete root.dataset.theme
    localStorage.removeItem('theme')
  } else {
    root.dataset.theme = theme.value
    localStorage.setItem('theme', theme.value)
  }
  const dark = theme.value === 'dark' || (theme.value === 'auto' && systemDark.value)
  document.querySelector('meta[name="theme-color"]').content = dark ? BAR.dark : BAR.light
})
