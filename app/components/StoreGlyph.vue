<script setup lang="ts">
type Glyph='chat'|'orders'|'menu'|'smile'|'door'|'arrow'|'check'|'people'|'feedback'
const props=defineProps<{name:Glyph}>()
const paths:Record<Glyph,string>={
  feedback:'M3 1h10v2h2v12H1V3h2V1Zm1 2v2h8V3H4Zm-1 4v6h10V7H3Zm2 1h6v1H5V8Zm1 3h4v1H6v-1Z',
  chat:'M2 2h12v9H7v2H5v2H3v-4H2V2Zm2 2v5h1v2h1V9h6V4H4Zm1 1h6v1H5V5Zm0 2h4v1H5V7Z',
  orders:'M5 1h6v2h3v12H2V3h3V1Zm1 1v2h4V2H6ZM4 5v8h8V5h-1v1H5V5H4Zm1 2h6v1H5V7Zm0 3h5v1H5v-1Z',
  menu:'M1 2h14v12H1V2Zm2 2v8h10V4H3Zm1 1h5v1H4V5Zm0 3h8v1H4V8Zm0 3h6v1H4v-1Zm7-6h1v1h-1V5Z',
  smile:'M4 1h8v1h2v2h1v8h-1v2h-2v1H4v-1H2v-2H1V4h1V2h2V1Zm0 2v1H3v8h1v1h8v-1h1V4h-1V3H4Zm1 2h2v2H5V5Zm4 0h2v2H9V5Zm-5 4h2v2h4V9h2v3h-2v1H6v-1H4V9Z',
  door:'M2 1h7v2H4v10h5v2H2V1Zm9 3h2v2h2v4h-2v2h-2v-2h2V9H6V7h7V6h-2V4Z',
  arrow:'M9 2h2v2h2v2h2v4h-2v2h-2v2H9v-2h2v-2h2V9H1V7h12V6h-2V4H9V2Z',
  check:'M12 3h2v3h-2v2h-2v2H8v2H5v-2H3V8H1V5h2v2h2v2h2V7h2V5h3V3Z',
  people:'M4 1h4v1h1v4H8v1H4V6H3V2h1V1Zm1 2v2h2V3H5Zm6 0h3v1h1v3h-1v1h-3V6h2V5h-2V3ZM3 9h6v1h2v5H9v-4H3v4H1v-5h2V9Zm9 0h2v1h1v5h-2v-4h-1V9Z',
}
</script>
<template><svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path :d="paths[props.name]"/></svg></template>
