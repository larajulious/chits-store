<script setup lang="ts">
import { avatarOptions, type AvatarId } from '../../shared/avatars'
const props=defineProps<{avatar:AvatarId;saving:boolean;error:string;storeOpen:boolean;statusReady:boolean}>()
const emit=defineEmits<{ 'update:avatar':[value:AvatarId];enter:[] }>()
const selected=computed(()=>avatarOptions.find(option=>option.id===props.avatar)!)
</script>
<template>
  <main class="structured-lobby">
    <header class="lobby-header">
      <div class="lobby-brand"><span class="brand-mark"><AvatarIcon avatar="palitaw"/></span><div><strong>CHITS STORE</strong><span>A little company. A little kakanin.</span></div></div>
      <span class="welcome-tag" :class="{'store-closed-tag':statusReady&&!storeOpen}">{{ !statusReady?'Checking store…':storeOpen?'Everyone’s welcome':'Closed for now' }}</span>
    </header>
    <div class="lobby-content">
      <section class="lobby-welcome" aria-labelledby="welcome-heading">
        <p class="lobby-eyebrow">YOUR NEIGHBORHOOD VIRTUAL BAKERY</p>
        <h1 v-if="storeOpen||!statusReady" id="welcome-heading">Come in.<br>Make yourself<br><em>at home.</em></h1>
        <h1 v-else id="welcome-heading">See you<br><em>again soon.</em></h1>
        <p class="welcome-copy">{{ statusReady&&!storeOpen?'Chits Meryenda Hub is closed right now. Come back when we open the doors again.':'A cozy place to hang out, meet other visitors, and follow what’s cooking.' }}</p>
        <div class="bakery-scene" :class="{'scene-closed':statusReady&&!storeOpen}" aria-hidden="true">
          <div class="welcome-store">
            <div class="store-roof"/>
            <div class="store-chimney"><span class="store-steam steam-one"/><span class="store-steam steam-two"/></div>
            <div class="store-window left"/><div class="store-window right"/>
            <div class="store-sign">✦ CHITS STORE ✦</div><div class="store-door"/>
            <div v-if="statusReady&&storeOpen" class="store-visitors">
              <div class="store-visitor visitor-left"><span class="visitor-walk"><PixelSprite name="walk-mochi" :scale="1"/></span></div>
              <div class="store-visitor visitor-right"><span class="visitor-walk"><PixelSprite name="walk-biko" :scale="1"/></span></div>
            </div>
            <div v-if="statusReady&&!storeOpen" class="store-closed-placard"><span>CLOSED</span></div>
            <div v-if="statusReady&&!storeOpen" class="store-sleep"><span>Z</span><span>Z</span><span>Z</span></div>
          </div>
          <span class="scene-caption">A small store with room for you.</span>
        </div>
        <ul class="visit-features"><li><StoreGlyph name="door"/>Explore the bakery</li><li><StoreGlyph name="people"/>Meet other visitors</li><li><StoreGlyph name="orders"/>Check live orders</li></ul>
      </section>
      <form class="buddy-panel" @submit.prevent="emit('enter')">
        <div class="buddy-panel-heading"><div><p class="lobby-eyebrow">BEFORE YOU HEAD IN</p><h2 id="buddy-heading">Pick your food buddy</h2></div><span class="buddy-count">{{ avatarOptions.length }} buddies</span></div>
        <p class="buddy-description">A familiar favorite, or something new?</p>
        <fieldset class="buddy-grid" :disabled="saving" aria-labelledby="buddy-heading">
          <button v-for="option in avatarOptions" :key="option.id" type="button" class="buddy-choice" :class="{selected:avatar===option.id}" :aria-pressed="avatar===option.id" @click="emit('update:avatar',option.id)">
            <span v-if="avatar===option.id" class="selection-check"><StoreGlyph name="check"/></span>
            <AvatarIcon :avatar="option.id"/><span class="buddy-name">{{ option.label }}</span>
          </button>
        </fieldset>
        <p class="carousel-hint"><span>Swipe to explore all {{ avatarOptions.length }} buddies</span><StoreGlyph name="arrow"/></p>
        <div class="buddy-selection" aria-live="polite"><span class="selected-portrait"><AvatarIcon :avatar="avatar"/></span><div><span class="selection-label">YOUR FOOD BUDDY</span><strong>{{ selected.label }}</strong></div><span class="selection-ready"><StoreGlyph v-if="storeOpen" name="check"/>{{ storeOpen?'Ready to visit':'See you soon' }}</span></div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="enter-bakery" type="submit" :disabled="saving||!statusReady||!storeOpen"><span>{{ saving?'Opening the door…':!statusReady?'Checking store…':storeOpen?'Enter the store':'Store closed' }}</span><StoreGlyph name="arrow"/></button>
        <p class="entry-note">{{ statusReady&&!storeOpen?'Please visit us again soon.':'No account needed. We’ll give you a guest name.' }}</p>
      </form>
    </div>
    <footer class="lobby-footer"><span>A little pause in your day.</span><span>Choose a buddy. Stay awhile.</span></footer>
  </main>
</template>
<style scoped>
.structured-lobby{--ink:#443126;--quiet:#806b59;--line:#e5d8c7;--paper:#fffaf1;min-height:100dvh;display:flex;flex-direction:column;background:#f6f0e6;color:var(--ink);padding:0 36px 16px}
.lobby-header,.lobby-content,.lobby-footer{width:min(100%,1080px);margin-inline:auto}
.lobby-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 0;border-bottom:1px solid var(--line)}
.lobby-brand{display:flex;align-items:center;gap:12px}.brand-mark{display:grid;place-items:center;width:46px;height:46px;border:1px solid #e5d5bc;border-radius:14px;background:#eee2cc}.brand-mark :deep(.avatar-symbol){transform:scale(.8)}
.lobby-brand strong{display:block;font-size:14px;letter-spacing:.11em}.lobby-brand div>span{display:block;font-size:12px;color:var(--quiet);margin-top:4px}.welcome-tag{font-size:12px;font-weight:700;padding:8px 12px;border:1px solid #d9dfcb;border-radius:100px;color:#62724c;background:#ecedde;white-space:nowrap}
.lobby-content{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,490px);gap:64px;align-items:center;padding-block:clamp(12px,4dvh,40px)}
.lobby-eyebrow{margin:0 0 12px;font-size:10px;font-weight:800;line-height:1.5;letter-spacing:.15em;color:#927255}
.lobby-welcome h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(42px,4.5vw,60px);font-weight:400;letter-spacing:-.055em;line-height:1.06;margin:0}.lobby-welcome h1 em{color:#906044;font-weight:400}
.welcome-copy{max-width:350px;color:var(--quiet);font-size:15px;line-height:1.8;margin:20px 0 24px}.bakery-scene{max-width:360px;background:#eee3d1;border:1px solid #e2d1b7;border-radius:20px;padding:20px 24px 14px}.bakery-scene .welcome-store{height:200px;border-width:5px;border-radius:12px;box-shadow:0 6px 0 #d7c4a7}.bakery-scene .store-sign{font-size:11px;padding:7px 12px;border-width:3px;top:48px}.bakery-scene .store-roof{height:54px}.bakery-scene .store-window{width:64px;height:59px;border-width:5px;bottom:26px}.bakery-scene .store-window.left{left:12px}.bakery-scene .store-window.right{right:12px}.bakery-scene .store-door{width:60px;height:85px;left:calc(50% - 30px);border-width:5px}.scene-caption{display:block;margin-top:15px;text-align:center;color:#8b765f;font-size:11px}
.visit-features{list-style:none;padding:0;margin:24px 0 0;display:flex;flex-wrap:wrap;gap:12px 18px;font-size:11px;color:var(--quiet)}.visit-features li{display:flex;align-items:center;gap:6px}.visit-features svg{width:15px;height:15px;color:#9c8061}
.buddy-panel{padding:28px;background:var(--paper);border:1px solid #ded0bd;border-radius:24px;box-shadow:0 8px 28px #67482708}.buddy-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.buddy-panel-heading .lobby-eyebrow{margin-bottom:6px}.buddy-panel-heading h2{font-size:22px;letter-spacing:-.045em;line-height:1.2;margin:0}.buddy-count{font-size:10px;font-weight:700;border:1px solid var(--line);border-radius:100px;padding:5px 8px;white-space:nowrap;color:var(--quiet)}.buddy-description{font-size:12px;color:var(--quiet);margin:10px 0 22px}
.buddy-grid{min-width:0;border:0;padding:0;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.buddy-choice{position:relative;min-width:0;min-height:92px;padding:13px 4px 9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid #e6dbc9;border-radius:13px;background:#f9f4e9;color:#6e5844;transition:background .15s,border-color .15s,box-shadow .15s}.buddy-choice:hover{background:#f2e7d4;border-color:#c9ac85}.buddy-choice.selected{border:2px solid #946d47;background:#eee0c5;box-shadow:0 0 0 2px #946d4710;padding:12px 3px 8px;color:#523a25}.buddy-choice :deep(.avatar-symbol){height:38px;font-size:30px}.buddy-choice :deep(.avatar-symbol svg){width:38px;height:38px}.buddy-name{font-size:11px;font-weight:800;line-height:1.3;min-height:2.6em;display:flex;align-items:center;text-align:center}.selection-check{position:absolute;right:5px;top:5px;width:15px;height:15px;border-radius:50%;background:#946d47;color:#fff;display:grid;place-items:center}.selection-check :deep(svg){width:11px;height:11px;stroke-width:2.5}
.buddy-selection{display:flex;align-items:center;gap:10px;margin-top:20px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.selected-portrait{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:#eee5d3}.selected-portrait :deep(.avatar-symbol){transform:scale(.7)}.selection-label{display:block;font-size:9px;font-weight:800;letter-spacing:.09em;color:#9a8369}.buddy-selection strong{display:block;margin-top:3px;font-size:13px}.selection-ready{margin-left:auto;display:flex;align-items:center;gap:4px;font-size:10px;color:#71805b}.selection-ready svg{width:13px;height:13px}
.enter-bakery{width:100%;margin-top:18px;min-height:49px;padding:12px 17px;display:flex;align-items:center;justify-content:space-between;border:1px solid #62442f;border-radius:12px;background:#765339;color:#fff9ee;font-weight:800;font-size:13px;box-shadow:0 3px 0 #563a29}.enter-bakery:hover{background:#65452f}.enter-bakery:active{transform:translateY(2px);box-shadow:0 1px 0 #563a29}.entry-note{text-align:center;font-size:10px;line-height:1.6;color:#9a836a;margin:12px 0 0}.buddy-panel .error{margin-bottom:0}
.lobby-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:17px;color:#a18a71;font-size:10px;letter-spacing:.02em}
button:focus-visible{outline:3px solid #6c875d;outline-offset:3px}
.carousel-hint{display:none}
@media(max-width:1100px){.structured-lobby{padding-inline:24px}.lobby-content{gap:28px;grid-template-columns:minmax(0,1fr) minmax(0,440px)}.buddy-panel{padding:22px}.lobby-welcome h1{font-size:44px}.bakery-scene{padding:16px}.bakery-scene .store-window{width:50px}.visit-features{flex-direction:column;gap:10px}}
@media(max-width:900px){.structured-lobby{padding:0 16px 20px}.lobby-header{padding:16px 0}.lobby-brand strong{font-size:12px}.lobby-brand div>span{font-size:10px}.welcome-tag{font-size:10px;padding:7px 9px}.brand-mark{width:38px;height:38px}.lobby-content{max-width:540px;grid-template-columns:minmax(0,1fr);padding:24px 0;gap:24px}.lobby-welcome{position:relative;padding-right:122px;min-height:130px;display:flex;flex-direction:column;justify-content:center}.lobby-welcome .lobby-eyebrow{font-size:8px;letter-spacing:.1em;margin-bottom:8px}.lobby-welcome h1{font-size:34px;line-height:1.02}.welcome-copy{font-size:12px;line-height:1.65;margin:12px 0 0}.bakery-scene{position:absolute;right:0;top:9px;width:108px;padding:8px;border-radius:14px}.bakery-scene .welcome-store{height:114px;border-width:3px;box-shadow:0 3px 0 #d7c4a7;border-radius:6px}.bakery-scene .store-roof{height:26px;border-bottom-width:4px}.bakery-scene .store-sign{font-size:5px;padding:3px 4px;border-width:1px;top:24px;letter-spacing:-.2px}.bakery-scene .store-window{width:20px;height:25px;border-width:2px;bottom:18px;box-shadow:none}.bakery-scene .store-window.left{left:5px}.bakery-scene .store-window.right{right:5px}.bakery-scene .store-door{width:24px;height:42px;left:calc(50% - 12px);border-width:2px;border-radius:4px 4px 0 0;box-shadow:inset 3px 0 #86b79b}.scene-caption,.visit-features{display:none}.buddy-panel{padding:20px 16px;border-radius:20px}.buddy-panel-heading h2{font-size:21px}.buddy-panel-heading .lobby-eyebrow{font-size:9px}.buddy-description{margin-bottom:18px}.buddy-grid{gap:7px}.buddy-choice{min-height:81px;padding-block:10px 7px}.buddy-choice.selected{padding-block:9px 6px}.buddy-choice :deep(.avatar-symbol){height:33px;font-size:28px}.buddy-choice :deep(.avatar-symbol svg){width:33px;height:33px}.buddy-name{font-size:11px}.buddy-selection{margin-top:16px}.lobby-footer{font-size:9px}.lobby-footer span:last-child{display:none}}
@media(max-width:359px){.buddy-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.lobby-brand div>span,.buddy-count{display:none}.lobby-welcome{padding-right:104px}.lobby-welcome h1{font-size:30px}.bakery-scene{width:94px}.buddy-panel-heading h2{font-size:20px}}
@media(min-width:901px) and (max-height:820px){
  .structured-lobby{padding-bottom:12px}.lobby-header{padding-block:14px}.lobby-content{padding-block:12px;gap:36px}
  .lobby-welcome h1{font-size:42px}.welcome-copy{margin-block:12px;font-size:14px;line-height:1.6}
  .bakery-scene{padding:14px 20px 12px}.bakery-scene .welcome-store{height:160px}.bakery-scene .store-roof{height:42px}.bakery-scene .store-sign{top:38px}.bakery-scene .store-door{height:64px}.bakery-scene .store-window{height:48px;bottom:20px}.scene-caption{margin-top:12px}.visit-features{margin-top:16px}
  .buddy-panel{padding:20px}.buddy-description{margin-bottom:16px}.buddy-choice{min-height:80px;padding-block:8px 6px}.buddy-choice.selected{padding-block:7px 5px}
  .buddy-choice :deep(.avatar-symbol){height:32px;font-size:28px}.buddy-choice :deep(.avatar-symbol svg){width:32px;height:32px}.buddy-name{font-size:10px}
  .buddy-selection{margin-top:14px;padding-block:10px}.enter-bakery{margin-top:14px}.lobby-footer{padding-top:12px}
}
@media(max-width:900px) and (max-height:900px){
  .structured-lobby{padding-bottom:12px}.lobby-header{padding-block:12px}
  .lobby-content{padding-block:16px;gap:16px;align-content:center}
  .lobby-welcome{min-height:0}.lobby-welcome h1{font-size:28px}.welcome-copy{margin-top:8px;line-height:1.5}
  .bakery-scene{top:0}.buddy-panel{padding:16px}.buddy-description{margin-block:8px 12px}
  .buddy-choice{min-height:72px;padding-block:7px 5px;gap:4px}.buddy-choice.selected{padding-block:6px 4px}
  .buddy-choice :deep(.avatar-symbol){height:29px;font-size:26px}.buddy-choice :deep(.avatar-symbol svg){width:29px;height:29px}
  .buddy-selection{margin-top:12px;padding-block:8px}.selected-portrait{width:34px;height:34px}.enter-bakery{margin-top:12px;min-height:44px;padding-block:10px}.entry-note{margin-top:8px}.lobby-footer{padding-top:10px}
}
@media(max-width:900px) and (max-height:760px){
  .lobby-header{padding-block:10px}.lobby-content{padding-block:12px;gap:12px}
  .lobby-welcome{padding-right:104px}.lobby-welcome h1{font-size:24px}.lobby-welcome .lobby-eyebrow{margin-bottom:6px;font-size:7px}.welcome-copy{font-size:11px;margin-top:6px}
  .bakery-scene{width:94px;padding:6px}.bakery-scene .welcome-store{height:100px}
  .buddy-panel{padding:12px}.buddy-panel-heading h2{font-size:19px}.buddy-panel-heading .lobby-eyebrow{font-size:8px;margin-bottom:4px}.buddy-description{margin-block:6px 10px}
  .buddy-choice{min-height:64px;padding-block:5px 3px;gap:2px}.buddy-choice.selected{padding-block:4px 2px}.buddy-choice :deep(.avatar-symbol){height:26px;font-size:24px}.buddy-choice :deep(.avatar-symbol svg){width:26px;height:26px}
  .buddy-selection{margin-top:10px;padding-block:6px}.entry-note{margin-top:6px}.lobby-footer{padding-top:8px}
}
@media(max-width:900px) and (max-height:700px){
  .lobby-content{padding-block:8px;gap:10px}.brand-mark{width:32px;height:32px}
  .lobby-welcome .lobby-eyebrow,.buddy-panel-heading .lobby-eyebrow{display:none}
  .buddy-description{margin-block:4px 8px}.welcome-copy{margin-top:4px}
}
@media(max-width:600px){
  .lobby-content{gap:20px;padding-block:20px;align-content:center}
  .lobby-welcome{display:grid;grid-template-columns:minmax(0,1fr) clamp(116px,34vw,148px);gap:12px 16px;align-items:center;padding:0;min-height:0}
  .lobby-welcome .lobby-eyebrow{display:none}.lobby-welcome h1{grid-column:1;grid-row:1;font-size:clamp(26px,8.2vw,34px);line-height:1.04}
  .welcome-copy{grid-column:1/-1;grid-row:2;max-width:none;font-size:12px;line-height:1.6;margin:0}
  .bakery-scene{position:static;grid-column:2;grid-row:1;width:100%;max-width:none;padding:9px;border-radius:14px}
  .bakery-scene .welcome-store{width:100%;height:auto;aspect-ratio:1.12;border-width:3px;border-radius:7px}
  .bakery-scene .store-roof{height:25%;border-bottom-width:3px}
  .bakery-scene .store-sign{top:24%;font-size:clamp(5px,1.5vw,7px);padding:3px 4px;border-width:1px;letter-spacing:0}
  .bakery-scene .store-window{width:22%;height:26%;bottom:16%;border-width:2px}
  .bakery-scene .store-window.left{left:5%}.bakery-scene .store-window.right{right:5%}
  .bakery-scene .store-door{width:24%;height:39%;left:38%;border-width:2px;border-radius:4px 4px 0 0}
  .buddy-panel{min-width:0;padding:16px}.buddy-panel-heading h2{font-size:21px}.buddy-description{margin:8px 0 12px}
  .buddy-grid{width:100%;grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:82px;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scroll-padding-inline:4px;padding:4px 4px 10px;margin:0;scrollbar-width:thin;scrollbar-color:#c1a17e #f0e6d5}
  .buddy-choice{min-height:91px;scroll-snap-align:start;padding:12px 5px 7px;gap:7px}.buddy-choice.selected{padding:11px 4px 6px}
  .buddy-choice :deep(.avatar-symbol){height:36px;font-size:30px}.buddy-choice :deep(.avatar-symbol svg){width:36px;height:36px}
  .buddy-name{font-size:11px;min-height:1.3em}
  .carousel-hint{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 4px 0;font-size:10px;color:var(--quiet)}.carousel-hint svg{width:14px;height:14px}
  .buddy-selection{margin-top:14px;padding-block:10px}.selected-portrait{width:36px;height:36px}.enter-bakery{min-height:48px;margin-top:14px}.entry-note{margin-top:10px}
}
@media(max-width:600px) and (max-height:700px){
  .lobby-content{padding-block:12px;gap:16px}.lobby-welcome{gap:10px 16px}.lobby-welcome h1{font-size:clamp(26px,7.5vw,30px)}
  .buddy-panel{padding:14px}.buddy-selection{margin-top:10px;padding-block:8px}.enter-bakery{margin-top:12px}.entry-note{margin-top:8px}
}
@media(max-width:359px){
  .lobby-brand strong{white-space:nowrap}.welcome-tag{font-size:9px;padding-inline:7px}
  .lobby-welcome{grid-template-columns:minmax(0,1fr) 104px;column-gap:12px}.lobby-welcome h1{font-size:24px}
}
@media(prefers-reduced-motion:reduce){.buddy-choice{transition:none}}
</style>

<style scoped src="../assets/css/pixel-entrance.css"/>
