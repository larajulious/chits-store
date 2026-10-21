export default defineNitroPlugin(nitro=>{
  Object.assign(nitro.h3App.options,{websocket:{serverOptions:{maxPayload:4096,perMessageDeflate:false}}})
})
