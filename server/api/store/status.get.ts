import {defineEventHandler,setHeader} from 'h3'
import {isStoreOpen} from '../../utils/store'

export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','no-store')
  return {open:isStoreOpen()}
})
