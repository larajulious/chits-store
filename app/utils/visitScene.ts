import {isScene,type SceneId} from '../../shared/world'

// The scene this tab is in, so a refresh puts the visitor back where they were standing.
// Per tab (sessionStorage) and cleared when a visit ends, so a new visit always starts inside the store.
const KEY='chits-scene'
export function readVisitScene():SceneId{try{const value=sessionStorage.getItem(KEY);return isScene(value)?value:'store'}catch{return 'store'}}
export function saveVisitScene(scene:SceneId){try{if(scene==='store')sessionStorage.removeItem(KEY);else sessionStorage.setItem(KEY,scene)}catch{}}
export function clearVisitScene(){saveVisitScene('store')}
