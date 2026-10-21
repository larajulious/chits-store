<script setup lang="ts">
import { avatarOptions, type AvatarId } from '../../shared/avatars'
const avatar = ref<AvatarId>('mochi')
const route=useRoute()
const structuredLayout=computed(()=>route.query.layout==='structured')
const avatars = avatarOptions
const saving = ref(false)
const error = ref('')
async function enter() {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    await $fetch('/api/visitors/join', { method:'POST', body:{ avatar:avatar.value } })
    await navigateTo(structuredLayout.value?{path:'/store',query:{layout:'structured'}}:'/store')
  } catch (e:any) {
    error.value = e?.data?.statusMessage || 'Could not enter right now. Please try again.'
  } finally { saving.value = false }
}
</script>
<template>
  <StructuredEntrance v-if="structuredLayout" v-model:avatar="avatar" :saving="saving" :error="error" @enter="enter"/>
  <main v-else class="page"><section class="shell stack" style="max-width:470px;text-align:center">
    <div class="welcome-store"><div class="store-roof"/><div class="store-window left"/><div class="store-window right"/><div class="store-sign">✦ CHITS STORE ✦</div><div class="store-door"/></div>
    <div class="card stack">
      <span style="font-size:2rem">🍡 🍮 🧁</span>
      <h1 class="title" style="font-size:2rem;margin:0">Welcome to Chits Store!</h1>
      <p class="muted" style="margin:0;line-height:1.6">Come hang out in our cozy virtual bakery. Meet other visitors and check the live order board.</p>
      <label class="label" style="text-align:left">Choose your food buddy</label>
      <div class="grid-avatars">
        <button v-for="a in avatars" :key="a.id" type="button" class="avatar-choice" :class="{active:avatar===a.id}" :aria-pressed="avatar===a.id" @click="avatar=a.id">
          <AvatarIcon :avatar="a.id"/><span class="avatar-name">{{ a.label }}</span>
        </button>
      </div>
      <p class="help-text" style="margin:0">No account, nickname, or invitation needed. You'll get a fun guest name automatically.</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn full" :disabled="saving" @click="enter">{{ saving?'Opening the door...':'Enter the Store →' }}</button>
    </div>
  </section></main>
</template>
