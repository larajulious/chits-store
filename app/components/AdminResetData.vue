<script setup lang="ts">
type ResetOption='menu'|'orders'|'feedback'|'chat'|'visitors'
const emit=defineEmits<{reset:[options:ResetOption[]];'session-expired':[]}>()
const dialog=ref<HTMLDialogElement|null>(null)
const choices:[ResetOption,string,string][]=[
  ['menu',"Today's menu items",'Clear today’s food list and prices.'],
  ['orders','Orders and order numbers','Delete every order; the next order starts at 100.'],
  ['feedback','Suggestions and reviews','Delete pending, approved, and past feedback.'],
  ['chat','Chat history','Clear the current public conversation for everyone.'],
  ['visitors','Visitor sessions','Send everyone to the entrance and require a new avatar.'],
]
const selected=ref<ResetOption[]>([]),confirmation=ref(''),busy=ref(false),error=ref('')
function open(){dialog.value?.showModal()}
function close(){if(!busy.value)dialog.value?.close()}
function clearForm(){selected.value=[];confirmation.value='';error.value=''}
async function reset(){
  if(busy.value||!selected.value.length||confirmation.value!=='RESET')return
  busy.value=true;error.value=''
  try{
    const options=[...selected.value]
    await $fetch('/api/admin/reset',{method:'POST',body:{options,confirmation:confirmation.value}})
    dialog.value?.close()
    emit('reset',options)
  }catch(e:any){
    error.value=e?.data?.statusMessage||'Could not reset data. Nothing was cleared.'
    if(e?.response?.status===401)emit('session-expired')
  }finally{busy.value=false}
}
defineExpose({open})
</script>
<template>
  <dialog ref="dialog" class="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" @close="clearForm" @cancel="busy&&$event.preventDefault()">
    <form @submit.prevent="reset">
      <h2 id="reset-title">Reset store data</h2>
      <p id="reset-description">Choose exactly what to clear. This cannot be undone. Admin login and store open/closed status are kept.</p>
      <fieldset class="reset-options"><legend>Data to clear</legend>
        <label v-for="[value,label,description] in choices" :key="value" class="reset-choice"><input v-model="selected" type="checkbox" :value="value" :disabled="busy"><span><strong>{{ label }}</strong><small>{{ description }}</small></span></label>
      </fieldset>
      <p v-if="selected.includes('visitors')" class="reset-impact">Visitors currently inside will be sent to the entrance.</p>
      <label class="reset-field">Type RESET to confirm<input v-model="confirmation" type="text" autocomplete="off" spellcheck="false" :disabled="busy" placeholder="RESET"></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="reset-actions"><button type="button" class="btn secondary" :disabled="busy" @click="close">Cancel</button><button type="submit" class="btn reset-submit" :disabled="busy||!selected.length||confirmation!=='RESET'">{{ busy?'Resetting…':`Reset selected data${selected.length?` (${selected.length})`:''}` }}</button></div>
    </form>
  </dialog>
</template>
<style scoped>
.reset-dialog{box-sizing:border-box;width:min(560px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);padding:24px;border:3px solid #674731;background:#fff3da;color:#493425;box-shadow:6px 6px 0 #34281b;font:12px/1.55 'Courier New',monospace;overflow:auto}
.reset-dialog::backdrop{background:#34281bb3}.reset-dialog form{display:grid;gap:16px}.reset-dialog h2{margin:0;font:18px/1.5 Silkscreen,monospace}.reset-dialog p{margin:0}.reset-options{display:grid;gap:8px;margin:0;padding:0;border:0}.reset-options legend{font:11px/1.5 Silkscreen,monospace;margin-bottom:8px}.reset-choice{display:flex;align-items:flex-start;gap:12px;padding:10px;border:2px solid #c9a979;background:#fff9ec;cursor:pointer}.reset-choice:has(input:checked){background:#f7e3bd;border-color:#825a35}.reset-choice input{width:18px;height:18px;margin:2px 0 0;flex:none;accent-color:#694731}.reset-choice span{display:grid;gap:3px}.reset-choice strong{font-size:12px}.reset-choice small{font-size:11px;color:#755d45}.reset-field{display:grid;gap:6px;font-weight:700}.reset-field input{box-sizing:border-box;width:100%;min-height:44px;padding:9px 11px;border:2px solid #a17b50;background:#fffbef;color:#493425;font:13px 'Courier New',monospace}.reset-impact{padding:9px;border:2px solid #b97654;background:#f8e2d1}.reset-actions{display:flex;justify-content:flex-end;gap:10px}.reset-actions .btn{min-height:44px;border-radius:0;font:10px Silkscreen,monospace}.reset-submit{background:#995239;border-color:#713b2b;color:#fff4dd;box-shadow:3px 3px 0 #713b2b}.reset-dialog :focus-visible{outline:3px solid #617e4d;outline-offset:3px}.reset-dialog .error{margin:0}
@media(max-width:420px){.reset-dialog{padding:16px}.reset-actions{display:grid;grid-template-columns:1fr 2fr}.reset-actions .btn{width:100%;white-space:normal}}
</style>
