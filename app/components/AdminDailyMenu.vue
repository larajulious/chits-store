<script setup lang="ts">
type MenuItem = { id:number; name:string; priceCentavos:number }
type MenuState = { date:string; items:MenuItem[] }
const emit=defineEmits<{(event:'session-expired'):void}>()
const menu=ref<MenuState>({date:'',items:[]})
const dialog=ref<HTMLDialogElement|null>(null)
const name=ref(''),price=ref(''),editingId=ref<number|null>(null)
const loading=ref(true),busy=ref(false),error=ref(''),success=ref('')
const shownDate=computed(()=>menu.value.date?new Date(`${menu.value.date}T12:00:00`).toLocaleDateString('en-PH',{month:'long',day:'numeric'}):'Today')
const money=(centavos:number)=>`₱${(centavos/100).toFixed(2)}`
let refreshTimer:ReturnType<typeof setInterval>|undefined
onMounted(()=>{void refresh();refreshTimer=setInterval(()=>{if(!busy.value)void refresh()},60_000)})
onBeforeUnmount(()=>clearInterval(refreshTimer))
async function refresh(){
  try{
    const next=await $fetch<MenuState>('/api/admin/menu/today')
    if(menu.value.date&&menu.value.date!==next.date){editingId.value=null;name.value='';price.value=''}
    menu.value=next;error.value=''
  }catch(e:any){if(e?.response?.status===401)emit('session-expired');else error.value=e?.data?.statusMessage||'Could not load today’s menu'}
  finally{loading.value=false}
}
function edit(item:MenuItem){editingId.value=item.id;name.value=item.name;price.value=(item.priceCentavos/100).toFixed(2);error.value='';success.value=''}
function cancel(){editingId.value=null;name.value='';price.value='';error.value=''}
function open(){
  if(dialog.value?.open)return
  success.value='';error.value=''
  dialog.value?.showModal()
  void refresh()
}
function close(){if(!busy.value)dialog.value?.close()}
function onClose(){cancel();success.value=''}
function centavos(){
  const match=/^(\d{1,5})(?:\.(\d{1,2}))?$/.exec(price.value.trim())
  if(!match)return null
  const amount=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'))
  return amount>=1&&amount<=1_000_000?amount:null
}
async function save(){
  if(busy.value)return
  const amount=centavos()
  if(!name.value.trim()||name.value.trim().length>60){error.value='Enter an item name up to 60 characters.';return}
  if(amount===null){error.value='Enter a price from ₱0.01 to ₱10,000.00.';return}
  busy.value=true;error.value='';success.value=''
  try{
    const editing=editingId.value!==null
    menu.value=await $fetch<MenuState>('/api/admin/menu/today',{method:editing?'PATCH':'POST',body:{...(editing?{id:editingId.value}:{}),name:name.value,priceCentavos:amount}})
    cancel();success.value=editing?'Menu item updated.':'Menu item added.'
  }catch(e:any){if(e?.response?.status===401)emit('session-expired');error.value=e?.data?.statusMessage||'Could not save menu item'}
  finally{busy.value=false}
}
async function remove(item:MenuItem){
  if(busy.value)return
  busy.value=true;error.value='';success.value=''
  try{
    menu.value=await $fetch<MenuState>('/api/admin/menu/today',{method:'DELETE',body:{id:item.id}})
    if(editingId.value===item.id)cancel()
    success.value=`${item.name} removed from today’s menu.`
  }catch(e:any){if(e?.response?.status===401)emit('session-expired');error.value=e?.data?.statusMessage||'Could not remove menu item'}
  finally{busy.value=false}
}
defineExpose({open,refresh})
</script>
<template>
  <dialog ref="dialog" class="daily-menu-dialog" aria-labelledby="daily-menu-title" aria-describedby="daily-menu-description" @cancel="busy&&$event.preventDefault()" @close="onClose">
    <header class="menu-dialog-header">
      <div><span class="eyebrow">FOR THE MENU GUIDE</span><h2 id="daily-menu-title">Today's menu</h2><p id="daily-menu-description">{{ shownDate }} · {{ menu.items.length }} of 30 items</p></div>
      <button type="button" class="menu-close" aria-label="Close today's menu" autofocus :disabled="busy" @click="close">×</button>
    </header>
    <div class="menu-dialog-body">
      <p v-if="loading" class="menu-empty">Loading menu…</p>
      <template v-else>
        <div v-if="menu.items.length" class="menu-rows" aria-label="Today's menu items">
          <div v-for="item in menu.items" :key="item.id" class="menu-row"><span class="menu-name">{{ item.name }}</span><strong>{{ money(item.priceCentavos) }}</strong><div class="menu-row-actions"><button type="button" :disabled="busy" :aria-label="`Edit ${item.name}`" @click="edit(item)">Edit</button><button type="button" :disabled="busy" :aria-label="`Remove ${item.name}`" @click="remove(item)">×</button></div></div>
        </div>
        <p v-else class="menu-empty">No items yet. Add today’s meryenda and price below.</p>
        <form class="menu-form" @submit.prevent="save">
          <label class="menu-field">Item name<input v-model="name" type="text" maxlength="60" placeholder="e.g. Palitaw" autocomplete="off" required></label>
          <label class="menu-field price-field">Price (₱)<input v-model="price" type="text" inputmode="decimal" placeholder="35.00" autocomplete="off" required></label>
          <button type="submit" class="menu-save" :disabled="busy||(!editingId&&menu.items.length>=30)">{{ busy?'Saving…':editingId?'Save changes':'+ Add item' }}</button>
          <button v-if="editingId" type="button" class="menu-cancel" :disabled="busy" @click="cancel">Cancel</button>
        </form>
        <p v-if="error" class="menu-error" role="alert">{{ error }}</p><p v-else-if="success" class="menu-success" role="status">{{ success }}</p>
        <p class="menu-footnote">The guide shares today’s list and prices with visitors. A new list starts each day in Manila.</p>
      </template>
    </div>
  </dialog>
</template>
<style scoped>
.daily-menu-dialog{box-sizing:border-box;width:min(640px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);padding:0;border:3px solid #674731;border-radius:0;background:#fff3da;color:#493425;box-shadow:6px 6px 0 #34281b;font:12px/1.5 'Courier New',monospace;overflow-y:auto}
.daily-menu-dialog::backdrop{background:#34281bb3}
.menu-dialog-header{display:flex;align-items:start;justify-content:space-between;gap:18px;padding:18px 20px 15px;border-bottom:2px solid #d4b68a;background:#fff3da}
.eyebrow{display:block;margin-bottom:3px;color:#927150;font:8px/1.5 Silkscreen,monospace}
.menu-dialog-header h2{margin:0;color:#674731;font:18px/1.5 Silkscreen,monospace}
.menu-dialog-header p{margin:4px 0 0;color:#80694f;font-size:11px}
.menu-close{flex-shrink:0;width:36px;height:36px;border:2px solid #a17b50;border-radius:0;background:#eddbb8;color:#674731;box-shadow:2px 2px 0 #a17b50;font:24px/1 'Courier New',monospace;cursor:pointer}
.menu-dialog-body{padding:18px 20px 20px}
.menu-rows{max-height:min(35dvh,300px);overflow-y:auto;border:2px solid #d4b68a;background:#f9ebd0;scrollbar-width:thin}
.menu-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px dashed #ccb087}.menu-row:last-child{border-bottom:0}.menu-name{min-width:0;overflow-wrap:anywhere}.menu-row strong{white-space:nowrap;color:#674731}
.menu-row-actions{display:flex;gap:4px}.menu-row-actions button,.menu-cancel{min-height:32px;padding:5px 8px;border:1px solid #a17b50;border-radius:0;background:#eddbb8;color:#674731;font:10px Silkscreen,monospace;cursor:pointer}.menu-row-actions button:last-child{font:19px/1 'Courier New',monospace}
.menu-empty{margin:0;color:#80694f;font-size:12px}
.menu-form{display:flex;align-items:end;flex-wrap:wrap;gap:9px;margin-top:16px}.menu-field{display:grid;flex:1 1 190px;gap:5px;color:#674731;font:9px/1.5 Silkscreen,monospace}.price-field{flex:0 1 112px}.menu-field input{box-sizing:border-box;width:100%;min-width:0;min-height:40px;padding:8px;border:2px solid #b08a5e;border-radius:0;background:#fffbef;color:#493425;box-shadow:inset 2px 2px 0 #ead9ba;font:12px 'Courier New',monospace}
.menu-save{min-height:40px;padding:8px 12px;border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:2px 2px 0 #62412b;font:9px Silkscreen,monospace;cursor:pointer}
.daily-menu-dialog button:disabled{opacity:.6;cursor:default}.daily-menu-dialog button:focus-visible,.daily-menu-dialog input:focus-visible{outline:3px solid #617e4d;outline-offset:3px}
.menu-error,.menu-success{margin:12px 0 0;font-size:11px}.menu-error{color:#a13e32}.menu-success{color:#3e6843}.menu-footnote{margin:12px 0 0;color:#80694f;font-size:10px}
@media(max-width:599px){.menu-dialog-header{padding:15px 16px 13px}.menu-dialog-header h2{font-size:15px}.menu-dialog-body{padding:16px}.menu-field{flex:1 1 130px}.price-field{flex:0 1 90px}.menu-save{flex:1 1 100%}}
</style>
