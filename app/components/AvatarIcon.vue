<script setup lang="ts">
import { avatarOptions, type AvatarId } from '../../shared/avatars'
const props=defineProps<{avatar:AvatarId}>()
const option=computed(()=>avatarOptions.find(a=>a.id===props.avatar)!)
const body=computed(()=>`#${option.value.body.toString(16).padStart(6,'0')}`)
const detail=computed(()=>`#${option.value.detail.toString(16).padStart(6,'0')}`)
</script>
<template>
  <span class="avatar-symbol" aria-hidden="true">
    <svg viewBox="0 0 34 34" shape-rendering="crispEdges" width="44" height="44" focusable="false">
      <g v-if="avatar==='mochi'">
        <ellipse cx="17" cy="23" rx="15" ry="9" :fill="detail"/>
        <path d="M2 21C2 10 8 3 17 3S32 10 32 21Q32 29 17 29T2 21Z" :fill="body"/>
        <path d="M7 9h4m13-1h3M5 23h3m17 2h4" stroke="#fffaf0" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='maja'">
        <rect x="2" y="7" width="30" height="25" rx="3" :fill="detail"/>
        <rect x="2" y="3" width="30" height="25" rx="3" :fill="body"/>
        <path d="M6 6h4m5 1h4m5-1h4M5 25h5m14 0h5" stroke="#fff1a7" stroke-width="3"/>
        <path d="M11 3h3m8 1h3" :stroke="detail" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='boba'">
        <path d="M3 8h28l-4 24H7Z" :fill="detail"/>
        <path d="M5 9h24l-3 20H8Z" :fill="body"/>
        <path d="M23 2l-2 7" stroke="#735543" stroke-width="3"/>
        <rect x="2" y="6" width="30" height="4" rx="2" fill="#eed6b1"/>
        <g :fill="detail"><circle cx="11" cy="26" r="2"/><circle cx="17" cy="28" r="2"/><circle cx="23" cy="26" r="2"/></g>
      </g>
      <g v-else-if="avatar==='cupcake'">
        <path d="M4 21h26l-4 11H8Z" :fill="detail"/>
        <path d="M11 25l1 6m10-6-1 6m-4-6v6" stroke="#f5c58e" stroke-width="2"/>
        <g :fill="body"><rect x="3" y="10" width="28" height="14" rx="5"/><circle cx="10" cy="10" r="6"/><circle cx="23" cy="10" r="6"/><circle cx="17" cy="6" r="5"/></g>
        <path d="M9 6h3m11 1h3M15 3h3" stroke="#ffe9de" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='palitaw'">
        <ellipse cx="17" cy="19" rx="15" ry="11" :fill="detail"/>
        <ellipse cx="17" cy="16" rx="15" ry="11" :fill="body"/>
        <path d="M6 10h3m4-3h2m8 1h3m-19 15h3m13-1h3" stroke="#ba9664" stroke-width="2"/>
        <path d="M3 14h3m22 5h3m-16 7h4" stroke="#fffdf5" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='biko'">
        <rect x="2" y="6" width="30" height="25" rx="3" :fill="detail"/>
        <rect x="2" y="3" width="30" height="24" rx="3" :fill="body"/>
        <path d="M5 7h4m5-2h3m7 2h4m-22 15h4m13 0h5" :stroke="detail" stroke-width="3"/>
      </g>
      <g v-else-if="avatar==='puto'">
        <path d="M3 12h28l-4 19H7Z" fill="#e2ccaa"/>
        <rect x="3" y="9" width="28" height="19" rx="6" :fill="body"/>
        <ellipse cx="17" cy="11" rx="14" ry="9" :fill="body"/>
        <path d="M10 6h14" :stroke="detail" stroke-width="4"/>
      </g>
      <g v-else-if="avatar==='kutsinta'">
        <ellipse cx="17" cy="19" rx="15" ry="12" :fill="detail"/>
        <ellipse cx="17" cy="15" rx="15" ry="11" :fill="body"/>
        <ellipse cx="17" cy="8" rx="8" ry="3" fill="#dd9550"/>
        <path d="M7 24l3 2m3-1 2 3m4-3 2 2m3-4 3 2" stroke="#fff4da" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='suman'">
        <rect x="6" y="2" width="22" height="30" rx="4" :fill="detail"/>
        <path d="M9 2h12l5 30H13Z" :fill="body"/>
        <path d="M6 8h22M6 25h22" stroke="#e9d6a5" stroke-width="3"/>
      </g>
      <g v-else-if="avatar==='sapin-sapin'">
        <rect x="2" y="5" width="30" height="25" rx="3" :fill="detail"/>
        <path d="M2 12h30v9H2Z" fill="#fff2d9"/>
        <path d="M2 5h30v8H2Z" :fill="body"/>
        <path d="M6 6h4m13 2h5" stroke="#8d65a7" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='bibingka'">
        <path d="M1 7l16-4 16 4-2 24H3Z" :fill="detail"/>
        <ellipse cx="17" cy="17" rx="15" ry="13" :fill="body"/>
        <path d="M7 8h9m7 2h5" stroke="#fff1b9" stroke-width="3"/>
        <path d="M6 23h3m14 2h4" stroke="#bd8242" stroke-width="2"/>
      </g>
      <g v-else-if="avatar==='pichi-pichi'">
        <g :fill="body"><circle cx="10" cy="13" r="9"/><circle cx="24" cy="13" r="9"/><circle cx="17" cy="24" r="9"/></g>
        <path d="M4 10h3m8-4h3m9 3h4M6 20h3m4 9h3m9-4h3" :stroke="detail" stroke-width="3"/>
      </g>
      <g fill="#33251f"><rect x="9" y="13" width="3" height="4" rx="1"/><rect x="22" y="13" width="3" height="4" rx="1"/></g>
      <path d="M15 20h4" stroke="#815145" stroke-width="2" stroke-linecap="round"/>
      <g fill="#eaa1a0"><rect x="5" y="19" width="4" height="2"/><rect x="25" y="19" width="4" height="2"/></g>
    </svg>
  </span>
</template>
<style scoped>
.avatar-symbol{height:44px;display:flex;align-items:center;justify-content:center}
</style>
