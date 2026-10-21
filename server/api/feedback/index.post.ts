import {defineEventHandler,setHeader} from 'h3'
import {requireVisitor,verifyOrigin,clientAddress} from '../../utils/auth'
import {readJsonBody} from '../../utils/body'
import {submitFeedback} from '../../utils/feedback'
export default defineEventHandler(async event=>{
  const visitor=requireVisitor(event);verifyOrigin(event)
  const body=await readJsonBody<{kind?:unknown;text?:unknown}>(event)
  const result=submitFeedback(visitor,body,clientAddress(event))
  setHeader(event,'Cache-Control','no-store')
  return result
})
