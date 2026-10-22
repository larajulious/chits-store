import { createError } from 'h3'

export function orderNameInput(value:unknown){
  if(typeof value!=='string')throw createError({statusCode:400,statusMessage:'Order name must be text'})
  const name=value.trim()
  if(name.length>60||/[\u0000-\u001f\u007f-\u009f]/u.test(name))throw createError({statusCode:400,statusMessage:'Enter a name of up to 60 characters on one line'})
  return name
}
