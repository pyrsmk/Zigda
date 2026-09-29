<script setup>
import { useRouter } from 'vue-router'
import { repoChanged, session } from '../session.js'
import RepoPicker from '../components/RepoPicker.vue'
import Card from '../components/Card.vue'

const router = useRouter()

function saved(repo) {
  session.repo = repo
  repoChanged()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="setup">
    <Card class="box">
      <img src="/icon.svg" alt="" width="44" height="44" />
      <h1>Welcome {{ session.user.name || session.user.login }}!</h1>
      <p class="muted">
        You are the first person to sign in: you become the owner of this space. Choose the GitHub repository to open
        to the team, then the branch to work on.
      </p>
      <RepoPicker :current="session.repo" @saved="saved" />
    </Card>
  </div>
</template>

<style scoped>
.setup {
  min-height: 100%;
  display: flex;
  justify-content: center;
  padding: 50px 20px;
}

.box {
  width: 100%;
  max-width: 620px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-self: flex-start;
}

h1 {
  margin: 0;
  font-size: 24px;
}

p {
  margin: 0 0 8px;
  line-height: 1.55;
}
</style>
