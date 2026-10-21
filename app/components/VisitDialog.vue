<script setup lang="ts">
const props=defineProps<{variant:'leave'|'thanks';busy?:boolean}>()
const emit=defineEmits<{confirm:[]}>()
const dialog=ref<HTMLDialogElement|null>(null)
const headingId=useId(),descriptionId=useId()
function open(){if(!dialog.value?.open)dialog.value?.showModal()}
function close(){if(!props.busy)dialog.value?.close()}
function cancel(event:Event){if(props.busy)event.preventDefault()}
defineExpose({open,close})
</script>
<template>
  <dialog ref="dialog" class="visit-dialog" :aria-labelledby="headingId" :aria-describedby="descriptionId" @cancel="cancel">
    <div class="visit-dialog-content">
      <span class="visit-dialog-icon" aria-hidden="true"><AvatarIcon v-if="variant==='thanks'" avatar="palitaw"/><StoreGlyph v-else name="door"/></span>
      <h2 :id="headingId">{{ variant==='leave'?'Heading out?':'Salamat!' }}</h2>
      <p :id="descriptionId">{{ variant==='leave'?'Are you sure you want to leave Chits Meryenda Hub?':'Thank you for visiting Chits Meryenda Hub!' }}</p>
      <p class="visit-dialog-note">{{ variant==='leave'?'You can always come back for more kakanin and company.':'Come back soon for more kakanin and good company.' }}</p>
      <div v-if="variant==='leave'" class="visit-dialog-actions">
        <button type="button" class="visit-button secondary" autofocus :disabled="busy" @click="close">Stay a little longer</button>
        <button type="button" class="visit-button" :disabled="busy" @click="emit('confirm')">{{ busy?'Leaving…':'Yes, leave' }}</button>
      </div>
      <button v-else type="button" class="visit-button" autofocus @click="close">See you soon!</button>
    </div>
  </dialog>
</template>
<style scoped>
.visit-dialog{position:fixed;inset:0;margin:auto;width:min(420px,calc(100vw - 40px));max-height:calc(100dvh - 48px);padding:24px;border:3px solid #674731;border-radius:0;background:#fff3da;color:#493425;box-shadow:6px 6px 0 #34281b;font-family:'Courier New',monospace;overflow:auto}
.visit-dialog::backdrop{background:#34281bb3}
.visit-dialog-content{display:grid;gap:16px;text-align:center;justify-items:center;min-width:0}
.visit-dialog-icon{display:grid;place-items:center;width:58px;height:58px;border:2px solid #987047;background:#ecd8b1;box-shadow:3px 3px 0 #d0af7c}.visit-dialog-icon svg{width:28px;height:28px}.visit-dialog-icon :deep(.avatar-symbol){width:36px;height:36px}
.visit-dialog h2{font-family:Silkscreen,monospace;font-size:21px;font-weight:400;line-height:1.4;margin:0}.visit-dialog p{font-size:15px;line-height:1.6;margin:0;overflow-wrap:anywhere}.visit-dialog .visit-dialog-note{font-size:13px;color:#7d654c}
.visit-dialog-actions{display:grid;gap:12px;width:100%;margin-top:4px}.visit-button{width:100%;min-height:46px;padding:12px;border:2px solid #674731;border-radius:0;box-shadow:3px 3px 0 #b58b5e;background:#965b3b;color:#fff6de;font-family:Silkscreen,monospace;font-size:11px;line-height:1.5}.visit-button.secondary{background:#f4dfb6;color:#674731}.visit-button:hover{filter:brightness(1.06)}.visit-button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #b58b5e}.visit-button:focus-visible{outline:3px solid #6c875d;outline-offset:4px}
@media(max-height:500px){.visit-dialog{padding:16px}.visit-dialog-content{gap:10px}.visit-dialog-icon{display:none}}
</style>
