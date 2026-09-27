import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { apiPlugin } from './dev/api-plugin.js'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [vue(), apiPlugin()],
  }
})
