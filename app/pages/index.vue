<script setup lang="ts">
import type { AvatarId } from '../../shared/avatars'
import { clearVisitScene } from '../utils/visitScene'
const avatar = ref<AvatarId>('mochi')
const saving = ref(false)
const error = ref('')
const storeOpen=ref(false),statusReady=ref(false)
let statusTimer:ReturnType<typeof setInterval>|undefined
const visitThanks=useState<boolean>('visit-thanks',()=>false)
const thanksDialog=ref<{open:()=>void}|null>(null)
onMounted(()=>{
  if(visitThanks.value){visitThanks.value=false;thanksDialog.value?.open()}
  void refreshStoreStatus()
  statusTimer=setInterval(()=>void refreshStoreStatus(),15_000)
})
onBeforeUnmount(()=>clearInterval(statusTimer))
async function refreshStoreStatus(){
  try{const status=await $fetch<{open:boolean}>('/api/store/status');storeOpen.value=status.open;statusReady.value=true}
  catch{storeOpen.value=false;statusReady.value=false}
}
async function enter() {
  // Closed or open, visitors can come in; a closed store puts them on the street outside.
  if (saving.value||!statusReady.value) return
  saving.value = true; error.value = ''
  try {
    await $fetch('/api/visitors/join', { method:'POST', body:{ avatar:avatar.value } })
    // Every visit starts inside the store, even if this tab was last out on the street.
    clearVisitScene()
    await navigateTo('/store')
  } catch (e:any) {
    error.value = e?.data?.statusMessage || 'Could not enter right now. Please try again.'
    if(e?.response?.status===503)void refreshStoreStatus()
  } finally { saving.value = false }
}
</script>
<template>
  <div>
    <StructuredEntrance v-model:avatar="avatar" :saving="saving" :error="error" :store-open="storeOpen" :status-ready="statusReady" @enter="enter"/>
    <VisitDialog ref="thanksDialog" variant="thanks"/>
  </div>
</template>
