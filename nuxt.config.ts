export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',
  ssr: false,
  runtimeConfig: {
    public: {
      storeCatEnabled: true,
      storeGuideEnabled: true,
    },
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'node-server',
    experimental: { websocket: true },
  },
  experimental: { emitRouteChunkError: 'automatic-immediate' },
  routeRules: {
    '/': { headers: { 'Cache-Control': 'no-store' } },
    '/enter/**': { headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } },
    '/admin/**': { headers: { 'Cache-Control': 'no-store' } },
    '/store': { headers: { 'Cache-Control': 'no-store' } },
  },
  app: {
    head: {
      title: 'Chits Store',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' }],
    },
  },
})
