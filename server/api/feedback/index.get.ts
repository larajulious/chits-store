import {defineEventHandler,setHeader} from 'h3'
import {requireVisitor} from '../../utils/auth'
import {publicFeedback} from '../../utils/feedback'
export default defineEventHandler(event=>{
  requireVisitor(event)
  setHeader(event,'Cache-Control','no-store')
  return publicFeedback()
})
