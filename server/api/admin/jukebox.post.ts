import { readJsonBody } from '../../utils/body'
import { defineEventHandler, createError, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../utils/auth'
import { rescanJukeboxLibrary, skipJukeboxTrack, updateJukeboxSettings } from '../../utils/jukebox'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  const body = await readJsonBody<{action?:unknown;enabled?:unknown;votingEnabled?:unknown;trackIds?:unknown}>(event)
  setHeader(event, 'Cache-Control', 'no-store')
  if (body.action === 'skip') return skipJukeboxTrack()
  if (body.action === 'rescan') return rescanJukeboxLibrary()
  if (body.action === 'settings') {
    const changes: {enabled?:boolean;votingEnabled?:boolean;trackIds?:string[]} = {}
    if (body.enabled !== undefined) { if (typeof body.enabled !== 'boolean') throw createError({statusCode:400,statusMessage:'Invalid jukebox setting'}); changes.enabled = body.enabled }
    if (body.votingEnabled !== undefined) { if (typeof body.votingEnabled !== 'boolean') throw createError({statusCode:400,statusMessage:'Invalid voting setting'}); changes.votingEnabled = body.votingEnabled }
    if (body.trackIds !== undefined) {
      if (!Array.isArray(body.trackIds) || body.trackIds.length > 50 || body.trackIds.some(id => typeof id !== 'string')) throw createError({statusCode:400,statusMessage:'Invalid track selection'})
      changes.trackIds = body.trackIds as string[]
    }
    return updateJukeboxSettings(changes)
  }
  throw createError({statusCode:400,statusMessage:'Invalid jukebox action'})
})
