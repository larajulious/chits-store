<script setup lang="ts">
import type { AvatarId } from '../../shared/avatars'
const avatar = ref<AvatarId>('mochi')
const saving = ref(false)
const error = ref('')
const visitThanks=useState<boolean>('visit-thanks',()=>false)
const thanksDialog=ref<{open:()=>void}|null>(null)
onMounted(()=>{
  if(visitThanks.value){visitThanks.value=false;thanksDialog.value?.open()}
})
async function enter() {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    await $fetch('/api/visitors/join', { method:'POST', body:{ avatar:avatar.value } })
    await navigateTo('/store')
  } catch (e:any) {
    error.value = e?.data?.statusMessage || 'Could not enter right now. Please try again.'
  } finally { saving.value = false }
}
</script>
<template>
  <div>
    <StructuredEntrance v-model:avatar="avatar" :saving="saving" :error="error" @enter="enter"/>
    <VisitDialog ref="thanksDialog" variant="thanks"/>
  </div>
</template>
