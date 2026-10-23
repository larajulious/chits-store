import Phaser from 'phaser'
import {drinkOptions,type HeldDrink} from '../shared/cafe'
import {vendingProducts} from '../shared/world'
import * as cafe from './cafeArt'
import {PX,addTexture,setDepthIfChanged} from './common'

// Drinks visitors carry from scene to scene (a café cup or a cold can) until they throw them in a bin.
// Textures for every drink, as `cup-<id>`, and the bin's two frames.
export function createDrinkTextures(scene:Phaser.Scene){
  for(const drink of drinkOptions)addTexture(scene,`cup-${drink.id}`,cafe.cupArt(drink.id))
  for(const product of vendingProducts)if(!product.soon)addTexture(scene,`cup-${product.id}`,cafe.canArt(product.id))
  addTexture(scene,'bin-idle',cafe.binArt('idle'));addTexture(scene,'bin-open',cafe.binArt('open'))
}
// Where a drink sits on its holder: in the right hand, or up at the mouth for a sip. Follows the drawn lift.
export function handSpot(sprite:Phaser.GameObjects.Image,sipping:boolean){
  const lift=(sprite.originY-.5)*sprite.displayHeight
  return sipping?{x:sprite.x+6,y:sprite.y-lift-2}:{x:sprite.x+13,y:sprite.y-lift+8}
}
// The bin nearest a visitor who just let go of their drink, if they are standing by one.
export function binNear(bins:readonly Phaser.GameObjects.Image[],x:number,y:number){
  return bins.map(bin=>({bin,distance:Math.hypot(bin.x-x,bin.y-y)})).filter(entry=>entry.distance<=90).sort((a,b)=>a.distance-b.distance)[0]?.bin
}
// Over the rim in a little arc while the lid tips up, then gone.
export function tossIntoBin(scene:Phaser.Scene,cup:Phaser.GameObjects.Image,bin:Phaser.GameObjects.Image,instant:boolean){
  if(instant){cup.destroy();return}
  const fromX=cup.x,fromY=cup.y,toX=bin.x,toY=bin.y-bin.displayHeight/2+8,snap=(value:number)=>Math.round(value/PX)*PX
  bin.setTexture('bin-open');cup.setDepth(bin.depth+1)
  scene.tweens.addCounter({from:0,to:1,duration:420,
    onUpdate:tween=>{const p=tween.getValue()??0;cup.setPosition(snap(fromX+(toX-fromX)*p),snap(fromY+(toY-fromY)*p-Math.sin(p*Math.PI)*26))},
    onComplete:()=>{cup.destroy();scene.time.delayedCall(240,()=>{if(bin.active)bin.setTexture('bin-idle')})}})
}
// The drinks in a scene where nothing is set down (the store and the street): in each holder's hand, lifted for a sip,
// fading with them through a door, and tossed into the nearest bin when let go.
export class HeldDrinks{
  private held=new Map<Phaser.GameObjects.Image,{drink:HeldDrink;cup:Phaser.GameObjects.Image;sipUntil:number}>()
  constructor(private scene:Phaser.Scene,private bins:readonly Phaser.GameObjects.Image[],private instant:()=>boolean){}
  has(sprite:Phaser.GameObjects.Image){return this.held.has(sprite)}
  set(sprite:Phaser.GameObjects.Image,drink:HeldDrink|null){
    const entry=this.held.get(sprite)
    if((entry?.drink??null)===drink)return
    if(!drink){
      if(!entry)return
      this.held.delete(sprite)
      const bin=binNear(this.bins,sprite.x,sprite.y)
      if(bin)tossIntoBin(this.scene,entry.cup,bin,this.instant());else entry.cup.destroy()
      return
    }
    if(entry){entry.drink=drink;entry.cup.setTexture(`cup-${drink}`);return}
    const spot=handSpot(sprite,false)
    this.held.set(sprite,{drink,cup:this.scene.add.image(spot.x,spot.y,`cup-${drink}`).setScale(PX).setDepth(sprite.depth+.5),sipUntil:0})
  }
  sip(sprite:Phaser.GameObjects.Image){const entry=this.held.get(sprite);if(entry)entry.sipUntil=this.scene.time.now+1200;return Boolean(entry)}
  remove(sprite:Phaser.GameObjects.Image){this.held.get(sprite)?.cup.destroy();this.held.delete(sprite)}
  update(){
    for(const [sprite,entry] of this.held){
      if(!sprite.active){entry.cup.destroy();this.held.delete(sprite);continue}
      const spot=handSpot(sprite,this.scene.time.now<entry.sipUntil),cup=entry.cup
      if(cup.x!==spot.x||cup.y!==spot.y)cup.setPosition(spot.x,spot.y)
      setDepthIfChanged(cup,sprite.depth+.5)
      if(cup.alpha!==sprite.alpha)cup.setAlpha(sprite.alpha)
    }
  }
}
