<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Button from '../components/Button.vue'
import Card from '../components/Card.vue'

const route = useRoute()
const error = computed(() => {
  if (route.query.error === 'invitation') {
    return `The GitHub account “${route.query.account ?? ''}” hasn’t been invited yet. Ask the owner of the space for an invitation, then come back to sign in.`
  }
  if (route.query.error === 'oauth') return 'Signing in with GitHub failed, please try again.'
  return ''
})
</script>

<template>
  <div class="login">
    <Card class="box">
      <img src="/icon.svg" alt="" width="56" height="56" />
      <h1>Zigda</h1>
      <p class="muted">Read, discuss and grow a fabulous project together.</p>
      <div v-if="error" class="error">{{ error }}</div>
      <Button href="/api/auth/login" variant="primary" class="github">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        Sign in with GitHub
      </Button>
      <p class="faint small">
        No GitHub account yet? Just create one for free on
        <a href="https://github.com/signup" target="_blank" rel="noopener">github.com</a>, then send your username
        to the owner of the space.
      </p>
    </Card>
  </div>
</template>

<style scoped>
.login {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.box {
  width: 100%;
  max-width: 420px;
  padding: 38px 34px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

h1 {
  margin: 4px 0 0;
  font-size: 28px;
  font-weight: 800;
}

p {
  margin: 0;
  line-height: 1.5;
}

.github {
  margin: 12px 0 4px;
  padding: 12px 22px;
  font-size: 15px;
}

.small {
  font-size: 13px;
}
</style>
