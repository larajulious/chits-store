<script setup lang="ts">
import { avatarOptions } from '../../shared/avatars'
import { NICKNAME_MAX, checkNickname } from '../../shared/nickname'
// Choose the name others see, checked as you type with the server's own rule. The visitor number stays on the end.
const props=defineProps<{name:string;nickname:string;avatar:string}>()
const emit=defineEmits<{saved:[result:{nickname:string;name:string}]}>()
const draft=ref(props.name),saving=ref(false),error=ref('')
const buddy=computed(()=>avatarOptions.find(option=>option.id===props.avatar)?.label??'Guest')
const number=computed(()=>props.nickname.match(/#\d+$/)?.[0]??'')
const check=computed(()=>checkNickname(draft.value))
const preview=computed(()=>`${check.value.ok&&check.value.nickname||buddy.value} ${number.value}`.trim())
const unchanged=computed(()=>check.value.ok&&check.value.nickname===props.name)
async function save(value=draft.value){
  const result=checkNickname(value)
  if(!result.ok||saving.value)return
  saving.value=true;error.value=''
  try{
    const response=await $fetch<{nickname:string}>('/api/me/nickname',{method:'POST',body:{nickname:result.nickname}})
    emit('saved',{nickname:response.nickname,name:result.nickname})
  }catch(e:any){error.value=e?.data?.statusMessage||'Could not save your name. Please try again.'}
  finally{saving.value=false}
}
</script>
<template>
  <form class="nickname-panel" @submit.prevent="save()">
    <label class="nickname-label" for="nickname-input">Name</label>
    <input id="nickname-input" v-model="draft" class="input" :maxlength="NICKNAME_MAX+8" :placeholder="buddy" autocomplete="nickname" :aria-invalid="!check.ok" aria-describedby="nickname-preview" :disabled="saving">
    <p id="nickname-preview" class="nickname-preview" :class="{invalid:!check.ok}" role="status">{{ check.ok?`Others will see: ${preview}`:check.reason }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="nickname-actions">
      <button class="btn" type="submit" :disabled="saving||!check.ok||unchanged">{{ saving?'Saving…':'Save name' }}</button>
      <button v-if="name" class="btn secondary" type="button" :disabled="saving" @click="save('')">Use {{ buddy }}</button>
    </div>
    <p class="privacy">{{ NICKNAME_MAX }} characters at most: letters, numbers, spaces and . _ - '. Your visitor number keeps your name unique. Please don't use your real full name or anything personal.</p>
  </form>
</template>
<style scoped>
.nickname-panel{display:grid;gap:10px;min-width:0}
.nickname-label{font:10px/1 Silkscreen,monospace;letter-spacing:.06em;color:#8f7357;text-transform:uppercase}
.nickname-preview{margin:0;font:700 13px/1.4 'Courier New',monospace;color:#3f5a45}.nickname-preview.invalid{color:#a8432f}
.nickname-actions{display:flex;flex-wrap:wrap;gap:8px}
.privacy{margin:0}
</style>
