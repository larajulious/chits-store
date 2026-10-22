import { avatarOptions } from '../shared/avatars'

// Original Chits Store pixel art. Every texture is drawn at one art pixel per texture
// pixel and displayed at ART_SCALE world units, so the whole scene shares one grid.
export const ART_SCALE=2
type Color=string|null
type Palette=Record<string,Color>

export class PixelArt{
  readonly pixels:Color[]
  constructor(readonly width:number,readonly height:number){this.pixels=new Array(width*height).fill(null)}
  get(x:number,y:number):Color{return x>=0&&y>=0&&x<this.width&&y<this.height?this.pixels[y*this.width+x]!:null}
  set(x:number,y:number,color:Color){if(x>=0&&y>=0&&x<this.width&&y<this.height)this.pixels[y*this.width+x]=color;return this}
  rect(x:number,y:number,w:number,h:number,color:Color){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.set(i,j,color);return this}
  box(x:number,y:number,w:number,h:number,fill:Color,line:Color){this.rect(x,y,w,h,line);return this.rect(x+1,y+1,w-2,h-2,fill)}
  ellipse(cx:number,cy:number,rx:number,ry:number,color:Color){
    for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)
      if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)this.set(x,y,color)
    return this
  }
  // A tapered stroke, used for leaves and tails.
  stroke(x0:number,y0:number,x1:number,y1:number,radius:number,color:Color,taper=true){
    const length=Math.hypot(x1-x0,y1-y0)||1
    for(let y=Math.floor(Math.min(y0,y1)-radius);y<=Math.ceil(Math.max(y0,y1)+radius);y++)for(let x=Math.floor(Math.min(x0,x1)-radius);x<=Math.ceil(Math.max(x0,x1)+radius);x++){
      const px=x+.5,py=y+.5,t=Math.max(0,Math.min(1,((px-x0)*(x1-x0)+(py-y0)*(y1-y0))/length**2))
      const r=taper?Math.max(.55,radius*Math.sin(Math.PI*Math.min(.98,Math.max(.12,t)))):radius
      if(Math.hypot(px-(x0+(x1-x0)*t),py-(y0+(y1-y0)*t))<=r)this.set(x,y,color)
    }
    return this
  }
  grid(x:number,y:number,rows:string[],palette:Palette){
    rows.forEach((row,j)=>{for(let i=0;i<row.length;i++){const key=row[i]!;if(key!=='.'&&key in palette)this.set(x+i,y+j,palette[key]!)}})
    return this
  }
  // Recolors existing pixels; used for eyes that blink or panels that share a shape.
  replace(from:Color,to:Color){for(let i=0;i<this.pixels.length;i++)if(this.pixels[i]===from)this.pixels[i]=to;return this}
  outline(color:Color){
    const solid=this.pixels.map(Boolean)
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
      if(solid[y*this.width+x])continue
      const near=(i:number,j:number)=>i>=0&&j>=0&&i<this.width&&j<this.height&&solid[j*this.width+i]
      if(near(x-1,y)||near(x+1,y)||near(x,y-1)||near(x,y+1))this.set(x,y,color)
    }
    return this
  }
  // Ground shadows fill only empty pixels so they never cover the outline.
  shadow(cx:number,cy:number,rx:number,ry:number,color='#6b46302e'){
    for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)
      if(!this.get(x,y)&&((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)this.set(x,y,color)
    return this
  }
  stamp(other:PixelArt,dx:number,dy:number,scale=1){
    for(let y=0;y<other.height;y++)for(let x=0;x<other.width;x++){const color=other.get(x,y);if(color)this.rect(dx+x*scale,dy+y*scale,scale,scale,color)}
    return this
  }
  toCanvas(){
    const canvas=document.createElement('canvas');canvas.width=this.width;canvas.height=this.height
    const context=canvas.getContext('2d')!,image=context.createImageData(this.width,this.height)
    this.pixels.forEach((color,i)=>{
      if(!color)return
      const value=color.slice(1)
      image.data[i*4]=parseInt(value.slice(0,2),16);image.data[i*4+1]=parseInt(value.slice(2,4),16);image.data[i*4+2]=parseInt(value.slice(4,6),16)
      image.data[i*4+3]=value.length===8?parseInt(value.slice(6,8),16):255
    })
    context.putImageData(image,0,0)
    return canvas
  }
}

const hex=(value:number)=>`#${value.toString(16).padStart(6,'0')}`
const INK='#3d2a1e',EYE='#2b1d16',BLUSH='#f3a09c',MOUTH='#7a3b30'
const WOOD_LIGHT='#c99460',WOOD='#a96f45',WOOD_DARK='#7a4f31',WOOD_DEEP='#5e3d27'
const CREAM='#fff8ea',LEAF='#5c9a4a',LEAF_DARK='#447f3a',LEAF_LIGHT='#7cb662'

// ---------- Characters ----------
type HeadId=typeof avatarOptions[number]['id']|'menu-guide'|'staff'|'chef'|'fixer'
function lowestRow(art:PixelArt,x:number){for(let y=art.height-1;y>=0;y--)if(art.get(x,y))return y;return -1}
// Heads are 20x16 with the shape inside x1..18, y1..14 so the outline fits.
export function headArt(id:HeadId,blink=false){
  const art=new PixelArt(20,16)
  const option=avatarOptions.find(a=>a.id===id)
  const body=option?hex(option.body):id==='menu-guide'?'#f3cf82':id==='chef'?'#fff3e2':'#fff0da'
  const detail=option?hex(option.detail):id==='menu-guide'?'#d9a85c':'#e8cfae'
  const shadeBottom=(color:string)=>{for(let x=0;x<20;x++){const y=lowestRow(art,x);if(y>4)art.set(x,y,color)}}
  const dots=(points:readonly (readonly [number,number])[],color:string)=>{for(const [x,y] of points)art.set(x,y,color)}
  // Each kakanin keeps the face area (rows 6..10) clear and shows its real-food cue above and below it:
  // banana leaf, latik, grated coconut, salted egg, cheese, pearls and so on.
  if(id==='mochi'){
    // Squishy rice-flour dome, dusted with flour and a soft shine.
    art.ellipse(10,8.5,8.5,6,body).rect(2,9,16,4,body).set(2,12,null).set(17,12,null)
    shadeBottom(detail)
    art.rect(5,3,2,1,'#ffffff').set(4,4,'#ffffff')
    dots([[9,2],[12,3],[15,5],[3,7],[16,8],[8,4],[13,12],[6,12]],'#fffdf8')
  }else if(id==='maja'){
    // Maja mais: a wobbly corn-pudding square with toasted coconut on top, served on banana leaf.
    art.rect(2,3,16,11,body).set(2,3,null).set(17,3,null)
    art.rect(3,2,14,2,'#d9963f').set(5,1,'#d9963f').set(10,1,'#d9963f').set(14,1,'#d9963f')
    dots([[4,2],[8,3],[12,2],[15,3],[7,1]],'#f2c77a')
    dots([[4,11],[7,12],[10,11],[13,12],[16,11],[5,5],[15,5]],'#fff3a0')
    dots([[4,12],[10,12],[16,12]],'#e2a63a')
    art.rect(3,4,3,1,'#fbe6a6')
    shadeBottom(detail)
    art.rect(1,14,18,1,LEAF).set(1,14,LEAF_DARK).set(18,14,LEAF_DARK)
  }else if(id==='biko'){
    // Sticky brown rice cake with a heap of golden latik curds, served on banana leaf.
    art.rect(2,4,16,10,body)
    for(const [x,y] of [[4,11],[13,12],[7,13],[11,11],[15,10],[3,6],[16,6]] as const)art.rect(x,y,2,1,'#dba468')
    art.rect(2,2,16,3,'#e9a94e')
    for(const x of [3,4,7,8,9,12,13,16])art.set(x,1,'#e9a94e')
    dots([[3,2],[6,3],[10,2],[14,3],[16,2],[8,1],[12,1]],'#c27a2e')
    dots([[5,2],[11,3],[15,2]],'#fbd384')
    shadeBottom(detail)
    art.rect(1,14,18,1,LEAF).set(1,14,LEAF_DARK).set(18,14,LEAF_DARK)
  }else if(id==='sapin-sapin'){
    // Three sticky layers (ube, coconut, jackfruit) with latik crumbs on top.
    art.rect(2,3,16,11,body).set(2,3,null).set(17,3,null).set(2,13,null).set(17,13,null)
    art.rect(2,6,16,4,'#fff2d9').rect(2,10,16,4,detail).set(2,13,null).set(17,13,null)
    art.rect(2,5,16,1,'#9a70ae').rect(2,9,16,1,'#ead9bd')
    art.rect(4,4,3,1,'#cfb0dd').rect(13,11,3,1,'#f3d68c')
    art.rect(3,2,14,1,'#c98a3e');dots([[5,1],[9,1],[13,1],[4,3],[11,3],[15,3]],'#c98a3e');dots([[7,2],[12,2]],'#e9b866')
  }else if(id==='boba'){
    // Milk tea under a domed lid with a striped straw and chewy pearls at the bottom.
    for(let y=5;y<=14;y++){const inset=Math.floor((y-5)/4);art.rect(3+inset,y,14-inset*2,1,body)}
    art.rect(4,6,1,4,'#d4b49a')
    for(const [x,y] of [[5,12],[8,12],[11,12],[13,11]] as const)art.rect(x,y,2,2,'#3a2418').set(x,y,'#7a5a48')
    art.rect(2,4,16,1,'#d9c6a6').rect(3,3,14,1,'#fbf4e6').rect(6,2,8,1,'#fbf4e6').rect(7,3,3,1,'#ffffff')
    art.rect(12,0,2,2,'#e07a9a').set(12,1,'#fbf4e6')
  }else if(id==='cupcake'){
    // Swirled frosting with sprinkles and a cherry, in a striped paper liner.
    for(let y=9;y<=14;y++){const inset=Math.floor((y-9)/3);art.rect(3+inset,y,14-inset*2,1,detail)}
    for(const x of [5,8,11,14])art.rect(x,10,1,4,'#f8c9d4')
    art.ellipse(10,7,8,3.5,body).ellipse(6,4.5,3.2,2.6,body).ellipse(14,4.5,3.2,2.6,body).ellipse(10,3.5,3.2,2.4,body)
    art.rect(4,8,12,1,'#e98d9c')
    dots([[5,4],[13,3]],'#7cc4e8');dots([[8,6],[15,6]],'#ffe066');dots([[11,5],[4,6]],'#a9ec8f');dots([[7,3]],'#ffffff')
    art.rect(9,0,2,2,'#d9473f').set(9,0,'#f28a7c').set(11,0,'#4f7d3a')
  }else if(id==='palitaw'){
    // The Chits mascot: a flat, tongue-shaped rice cake under grated coconut and toasted sesame.
    art.ellipse(10,9.5,9,4.6,body)
    shadeBottom(detail)
    art.ellipse(10,5.6,6.5,1.9,'#ffffff')
    dots([[5,5],[8,4],[11,5],[14,5],[7,6],[13,6],[10,4]],'#e9dcc4')
    dots([[6,4],[9,5],[12,4],[15,6],[4,6]],'#b07a45')
    dots([[10,5],[13,4]],'#6e4a31')
  }else if(id==='puto'){
    // Fluted steamed rice cake, domed on top, with a slice of cheese melting over it.
    art.ellipse(10,6.5,8.5,4,body)
    for(let y=6;y<=13;y++){const inset=Math.floor((y-6)/4);art.rect(2+inset,y,16-inset*2,1,body)}
    for(const x of [4,7,10,13,15])art.rect(x,11,1,3,'#eadcbb')
    art.rect(5,1,10,2,detail).rect(4,3,2,1,detail).rect(14,3,1,2,detail).rect(6,3,8,1,'#e0a82e').rect(6,1,3,1,'#f7d77c')
  }else if(id==='kutsinta'){
    // Glossy brown flower-cup cake with a heap of white grated coconut.
    art.ellipse(10,9,8.5,5,body).rect(3,9,14,5,body).set(3,13,null).set(16,13,null)
    for(const x of [4,7,10,13,15])art.rect(x,11,1,3,detail)
    art.rect(4,6,2,1,'#e39a5a').set(15,7,'#e39a5a')
    art.ellipse(10,3.6,5.5,2.4,'#fffaf0')
    dots([[7,3],[10,2],[13,3],[9,4],[12,5],[6,5]],'#e9dcc4')
  }else if(id==='suman'){
    // Sticky rice rolled in banana leaf, tied with string, rice showing at the open end.
    art.rect(4,2,12,12,body).rect(4,2,2,12,detail).rect(13,3,1,10,'#a6c180').rect(7,14,6,1,body)
    art.ellipse(10,2.2,4.6,1.4,'#fbf3e0');dots([[8,2],[11,1],[12,2]],'#e9dcc4')
    art.rect(3,5,14,1,'#d9b57a').rect(3,11,14,1,'#d9b57a').set(16,4,'#d9b57a').set(16,12,'#d9b57a')
  }else if(id==='bibingka'){
    // Golden rice cake on a banana leaf, charred spots, a salted-egg slice and grated coconut on top.
    art.ellipse(10,11,9.5,3.6,detail)
    for(const x of [1,5,9,14,18])art.set(x,12,LEAF_DARK)
    art.ellipse(10,7.8,8.3,5.4,body)
    dots([[4,5],[15,6],[6,11],[14,11],[11,12],[3,9]],'#b8742f')
    art.ellipse(10,3.5,3.6,1.9,'#fff8ea').rect(9,3,3,1,'#e0642f').set(10,2,'#e0642f')
    dots([[5,3],[15,4],[7,5]],'#ffffff')
  }else if(id==='pichi-pichi'){
    // Chewy cassava ball rolled in fluffy grated coconut.
    art.ellipse(10,8.5,8.5,6.2,body)
    for(const [x,y] of [[5,3],[9,2],[13,3],[3,5],[16,5],[2,8],[17,10],[4,12],[8,13],[12,13],[15,12],[7,4],[11,4]] as const)art.rect(x,y,2,1,detail)
    dots([[6,3],[15,4],[3,11],[10,13]],'#e9dcc4')
    shadeBottom('#d99a2e')
  }else{
    // Store characters: the menu guide, staff, chef and handyman.
    art.ellipse(10,8,8.5,6.5,body)
    shadeBottom(detail)
    if(id==='menu-guide')art.rect(3,2,14,2,'#fdf1d0').rect(2,4,16,1,'#e8d5aa')
    if(id==='staff')art.set(9,1,'#e8cfae').set(10,1,'#e8cfae').set(10,0,'#e8cfae')
    if(id==='chef')art.rect(2,3,16,2,'#2e2522').set(2,5,'#2e2522').set(17,5,'#2e2522')
    if(id==='fixer')art.rect(4,1,12,4,'#f2c84b').rect(2,4,16,2,'#d9a12e').rect(6,2,3,1,'#fbe39a').rect(9,1,2,3,'#e6b53c')
  }
  art.outline(INK)
  if(blink)art.rect(6,8,1,1,EYE).rect(13,8,1,1,EYE)
  else art.rect(6,7,1,2,EYE).rect(13,7,1,2,EYE)
  // Cheeks only land on the food itself, never floating on the outline of a narrow shape.
  for(const x of [3,4,15,16]){const under=art.get(x,9);if(under&&under!==INK)art.set(x,9,BLUSH)}
  art.rect(9,9,2,1,MOUTH)
  return art
}

// Visitors and the walking guide share one small body: green apron outfit, round head.
export function visitorArt(id:HeadId,frame:'idle'|'blink'|'step1'|'step2'){
  const option=avatarOptions.find(a=>a.id===id)
  const skin=option?hex(option.body):'#f3cf82'
  const body=new PixelArt(20,26)
  body.rect(5,14,10,7,'#5fa058').rect(14,15,1,6,'#4c8747').rect(7,15,6,6,'#f8f3e6').rect(7,14,1,1,'#f8f3e6').rect(12,14,1,1,'#f8f3e6').rect(8,19,4,1,'#e6dccb')
  body.rect(3,16,2,3,skin).rect(15,16,2,3,skin)
  const left=frame==='step1'?1:0,right=frame==='step2'?1:0
  body.rect(6,21,3,2-left,'#4a7d45').rect(6,23-left,3,1,'#5a3b27')
  body.rect(11,21,3,2-right,'#4a7d45').rect(11,23-right,3,1,'#5a3b27')
  body.outline(INK)
  return body.stamp(headArt(id,frame==='blink'),0,0).shadow(10,25,7,1.2)
}

export function chefArt(blink=false){
  const art=new PixelArt(22,32)
  const coat=new PixelArt(22,32)
  coat.rect(6,22,10,9,'#f6f1e6').rect(15,23,1,8,'#ddd5c6').rect(8,24,6,7,'#3b3a42').rect(8,22,1,2,'#3b3a42').rect(13,22,1,2,'#3b3a42')
  coat.rect(4,23,2,4,'#f6f1e6').rect(16,23,2,3,'#f6f1e6').rect(17,26,2,1,'#fff3e2')
  coat.outline(INK)
  art.stamp(coat,0,0).stamp(headArt('chef',blink),1,8)
  const hat=new PixelArt(22,14)
  hat.ellipse(11,4.5,6.5,3.5,'#fffdf6').ellipse(6.5,6,3.4,3,'#fffdf6').ellipse(15.5,6,3.4,3,'#fffdf6').rect(5,7,12,4,'#fffdf6')
  hat.rect(5,10,12,1,'#e4dccd').set(8,4,'#e4dccd').set(14,4,'#e4dccd').outline(INK)
  return art.stamp(hat,0,0)
}

export function staffArt(blink=false){
  const art=new PixelArt(20,26)
  art.rect(4,14,12,10,'#5c9e58').rect(15,15,1,9,'#4a8646').rect(8,14,4,2,'#f8f3e6').set(9,16,'#f8f3e6').set(10,16,'#f8f3e6')
  art.rect(2,16,2,4,'#5c9e58').rect(16,16,2,4,'#5c9e58').outline(INK)
  return art.stamp(headArt('staff',blink),0,0)
}

// ---------- Handyman fixing a floor tile ----------
// Kneeling in hard hat and safety vest; the right arm swings a hammer between frames.
export function fixerArt(frame:'up'|'down'|'rest'){
  const body=new PixelArt(26,24),skin='#fff0da',shirt='#5b7fa6',pants='#4a5f7a',steel='#9aa3ab',grip='#8a5c3a'
  body.rect(5,14,10,6,'#e8843c').rect(8,14,4,6,shirt).rect(5,17,10,1,'#fff3c4').rect(14,15,1,5,'#c96a2c')
  body.rect(3,15,2,3,shirt).set(3,18,skin).set(4,18,skin)
  body.rect(4,20,5,2,pants).rect(11,20,5,2,pants).rect(3,22,3,1,'#5a3b27').rect(14,22,3,1,'#5a3b27')
  if(frame==='up')body.rect(15,15,4,2,shirt).rect(19,11,2,5,shirt).rect(19,10,2,1,skin).rect(21,4,1,7,grip).rect(19,3,5,2,steel).rect(19,4,5,1,'#6f777f')
  else if(frame==='down')body.rect(15,16,4,2,shirt).rect(19,17,1,2,skin).rect(20,18,4,1,grip).rect(23,17,2,3,steel).set(24,19,'#6f777f')
  else body.rect(15,16,3,2,shirt).set(18,17,skin).rect(19,17,1,5,grip).rect(18,21,3,2,steel)
  body.outline(INK)
  return body.stamp(headArt('fixer'),0,0).shadow(11,23,9,1.2)
}
export function toolboxArt(){
  const art=new PixelArt(16,11)
  art.rect(1,4,14,6,'#c8553d').rect(1,4,14,1,'#a8432f').rect(1,5,14,1,'#e07a5c').rect(7,6,2,2,'#e8e2d0')
  art.rect(5,1,6,1,'#5f666e').rect(5,2,1,2,'#5f666e').rect(10,2,1,2,'#5f666e').outline(INK)
  return art.shadow(8,10.5,7,1)
}
export function coneArt(){
  const art=new PixelArt(11,13)
  for(let y=1;y<=9;y++){const half=Math.floor(y/2);art.rect(5-half,y,1+half*2,1,y===5||y===6?'#fff6e8':'#ee7d3a')}
  art.rect(1,10,9,2,'#d8662c').outline(INK)
  return art.shadow(5.5,12.5,5,1)
}
// The fresh tile in its gap, and the cracked tile that came out.
export function repairTileArt(){return new PixelArt(12,12).rect(0,0,12,12,'#a9835a').rect(1,1,10,10,'#f7e2bf').rect(1,1,10,1,'#fff1d6').rect(10,2,1,9,'#e6cba3')}
export function oldTileArt(){
  const art=new PixelArt(12,9).rect(1,1,10,7,'#e3c79d').rect(1,1,10,1,'#ecd4ad')
  for(const [x,y] of [[3,2],[4,3],[4,4],[5,5],[6,5],[7,6],[8,4],[9,3]] as const)art.set(x,y,'#8a6446')
  return art.outline('#b08a62')
}

// ---------- The shop cats: Miming (orange) and Onay (grey tabby) ----------
const CAT_HEAD=[
  '..oo......oo..',
  '.oOOo....oOOo.',
  '.oOpOooooOpOo.',
  'oOOOOODDOOOOOo',
  'oOODOOOOOODOOo',
  'oOOOkOOOOkOOOo',
  'oOpOkwwwwkOpOo',
  'oOOwwwppwwwOOo',
  '.oOwwkwwkwwOo.',
  '..oowwwwwwoo..',
  '....oooooo....',
]
const CAT_COLORS={o:'#4a2a1a',O:'#e8924a',D:'#c46a2c',w:'#fff4e6',p:'#f2a3a0',k:'#2b1d16'} satisfies Palette
// Onay: grey tabby with darker stripes and the same white muzzle and socks.
const ONAY_COLORS={o:'#2f2a2e',O:'#a6a3ad',D:'#6d6a76',w:'#fbf7f0',p:'#f2a3a0',k:'#2b1d16'} satisfies Palette
type CatCoat=typeof CAT_COLORS
export const CAT_COATS={Miming:CAT_COLORS,Onay:ONAY_COLORS}
function catHead(closed=false,palette:CatCoat=CAT_COLORS){
  const rows=closed?CAT_HEAD.map((row,y)=>y===5?row.replace(/k/g,'O'):y===6?'oOkkOwwwwOkkOo':row):CAT_HEAD
  return new PixelArt(14,11).grid(0,0,rows,palette)
}
export function catArt(pose:'lie'|'sleep'|'sit'|'notice'|'stand'|'walk'|'stretch'|'play',coat:CatCoat=CAT_COLORS){
  const {O,D,w,o}=coat
  if(pose==='lie'||pose==='sleep'){
    const art=new PixelArt(27,17)
    art.ellipse(15.5,10.5,8,4.5,O).stroke(22,11,24,4,1.4,O,false).rect(23,2,2,2,D)
    for(const [x,y] of [[13,6],[13,7],[16,6],[16,7],[19,7],[19,8]] as const)art.set(x,y,D)
    art.ellipse(4,13.6,2.2,1.5,w).ellipse(10,13.6,2.2,1.5,w).outline(o)
    return art.stamp(catHead(pose==='sleep',coat),0,1).shadow(14,15.6,12,1.4)
  }
  if(pose==='sit'||pose==='notice'){
    const art=new PixelArt(19,22)
    art.ellipse(9.5,15,6.5,5.2,O).ellipse(9.5,15.5,3,3.6,w).rect(5,19,3,2,w).rect(11,19,3,2,w)
    if(pose==='notice')art.stroke(15,17,17,8,1.2,O,false).rect(16,7,2,2,D)
    else art.rect(14,18,4,2,O).rect(17,18,1,2,D)
    art.outline(o)
    return art.stamp(catHead(false,coat),2,0).shadow(9.5,21,8,1.2)
  }
  if(pose==='stretch'){
    const art=new PixelArt(30,16)
    art.ellipse(17,9,9,3.2,O).rect(3,12,9,2,O).rect(1,12,3,2,w).stroke(25,9,27,2,1.3,O,false).rect(26,1,2,2,D)
    for(const [x,y] of [[15,6],[18,6],[21,7]] as const)art.set(x,y,D)
    art.rect(21,11,2,3,O).rect(24,10,2,4,O).outline(o)
    return art.stamp(catHead(true,coat),3,3).shadow(15,15,13,1.2)
  }
  // Standing poses face left; the scene flips them when a cat walks right.
  const art=new PixelArt(27,19)
  const step=pose==='walk'?1:0,paw=pose==='play'
  art.ellipse(16,10,8,3.8,O).stroke(23,9,25,2,1.3,O,false).rect(24,1,2,2,D)
  for(const [x,y] of [[14,7],[17,7],[20,8]] as const)art.set(x,y,D)
  art.rect(9,12,2,paw?2:4-step,O).rect(13,12,2,4,O).rect(18,12,2,4-step,O).rect(21,12,2,4,O)
  art.rect(9,paw?13:15-step,2,1,w).rect(13,15,2,1,w).rect(18,15-step,2,1,w).rect(21,15,2,1,w)
  art.outline(o)
  return art.stamp(catHead(false,coat),0,0).shadow(15,17.6,11,1.3)
}

export function yarnArt(rolling=false){
  const art=new PixelArt(13,11)
  art.ellipse(7,5,4.6,4.6,'#8b5cc4')
  const light='#bd95ea',dark='#643a9c'
  if(rolling){art.rect(4,3,6,1,light).rect(3,6,7,1,dark).set(8,8,light).set(5,1,dark)}
  else{for(const [x,y] of [[5,2],[6,2],[8,3],[9,4],[10,5]] as const)art.set(x,y,light);for(const [x,y] of [[4,5],[5,6],[6,7],[8,6],[9,7]] as const)art.set(x,y,dark)}
  art.outline('#3e2160').set(2,9,'#8b5cc4').set(1,9,'#8b5cc4').set(0,10,'#8b5cc4')
  return art.shadow(7,10.2,5,1)
}

// ---------- Furniture and props ----------
export function smallPlantArt(){
  const art=new PixelArt(12,15)
  art.stroke(6,9,6,1,1.6,LEAF).stroke(6,9,2,4,1.3,LEAF_DARK).stroke(6,9,10,4,1.3,LEAF_DARK).stroke(6,9,4,2,1,LEAF_LIGHT)
  art.rect(3,9,6,4,'#c4744a').rect(2,8,8,2,'#d98a5c').rect(8,10,1,3,'#a85f3a').outline(INK)
  return art
}
export function registerArt(){
  const art=new PixelArt(22,18)
  art.rect(4,1,13,9,'#3b3d44').rect(5,2,11,6,'#5f8f7a').rect(6,3,6,1,'#8fc0a8').rect(9,10,3,2,'#55575f')
  art.rect(1,12,20,5,'#5d6068').rect(1,12,20,1,'#7b7e87')
  for(const x of [3,6,9,12,15])art.set(x,14,'#b3b6be')
  return art.outline(INK)
}
export function clipboardArt(){
  const art=new PixelArt(13,16)
  art.rect(1,2,11,13,WOOD).rect(2,4,9,10,CREAM)
  for(const y of [6,8,10,12])art.rect(3,y,y===12?4:7,1,'#c9b89a')
  return art.rect(4,1,5,3,'#9aa0a6').rect(5,1,3,1,'#c5cad0').outline(INK)
}

export function kitchenCounterArt(){
  const art=new PixelArt(86,27)
  art.rect(1,1,84,4,'#d9a877').rect(1,1,84,1,'#ebc08f').rect(1,5,84,1,'#b07b4d').rect(1,6,84,18,'#9b6b45').rect(1,23,84,2,'#6e4930')
  for(const x of [22,43,64])art.rect(x,6,1,17,'#7e5334')
  for(const x of [18,26,39,47,60,68])art.rect(x,10,2,1,'#d9a877')
  return art.outline(INK)
}
export function orderCounterArt(){
  const art=new PixelArt(120,24)
  art.rect(1,1,118,5,'#dcae7c').rect(1,1,118,1,'#efc795').rect(1,6,118,1,'#b5824f').rect(1,7,118,14,'#94643f').rect(1,21,118,2,'#6a452c')
  art.box(7,9,106,10,'#8a5b3a','#6e4930').rect(8,10,104,1,'#9d6c47')
  return art.outline(INK)
}

const DOC_ICON=['ll........ll','l..........l','l..llllll..l','............','...llllll...','............','l..llll....l','l..........l','ll...ll...ll','.....l......']
export function feedbackBoardArt(){
  const art=new PixelArt(36,46)
  art.rect(4,38,3,7,WOOD_DARK).rect(29,38,3,7,WOOD_DARK)
  art.box(0,0,36,40,WOOD,INK).rect(2,2,32,36,'#8a5c3a').box(4,4,28,32,'#f6e2bc','#c9a578').rect(5,5,26,1,'#fff1d6')
  art.grid(12,14,DOC_ICON,{l:'#a07650'})
  art.box(8,27,20,8,'#fbefd6','#8a6446').rect(9,33,18,1,'#e6cfa6')
  art.rect(3,45,5,1,INK).rect(28,45,5,1,INK)
  return art.shadow(18,45,15,1.2)
}

export function entranceArt(){
  const art=new PixelArt(60,16)
  art.rect(0,9,60,7,'#7b5236').rect(0,9,60,1,'#94643f')
  art.box(6,0,48,12,'#f7e3bd','#8a6446').rect(7,1,46,1,'#fff3d9').rect(7,10,46,1,'#e3c697')
  return art
}

// ---------- Jukebox ----------
// An arched wooden cabinet with a light tube and a record behind glass. Frames 0..3 chase the
// lights and move the record's shine around its rim (the art itself never rotates).
const JUKEBOX_BULBS=['#ffd45e','#f3a09c','#a9ec8f','#fff1cf']
export function jukeboxArt(frame:0|1|2|3|'idle'){
  const art=new PixelArt(24,31),lit=frame!=='idle',step=lit?frame:0,TUBE='#010101',GLASS='#6a5070'
  art.ellipse(12,10.5,10,9.5,WOOD).rect(2,10,20,17,WOOD).rect(2,10,1,17,WOOD_LIGHT).rect(21,10,1,17,WOOD_DARK)
  art.ellipse(12,10.5,8,7.5,TUBE).rect(4,10,2,8,TUBE).rect(18,10,2,8,TUBE)
  art.ellipse(12,10.5,6.5,6,GLASS).rect(6,10,12,8,GLASS)
  for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++)if(art.get(x,y)===TUBE)
    art.set(x,y,lit?JUKEBOX_BULBS[(x+y+step)%JUKEBOX_BULBS.length]!:'#d9c09a')
  art.ellipse(12,12.5,4.5,3,'#1f1a24').ellipse(12,12.5,3,2,'#352c3c').ellipse(12,12.5,1.4,1,lit?'#e8924a':'#b97a4a')
  for(const turn of [0,2]){
    const angle=((step+turn)/4+1/8)*Math.PI*2
    art.set(Math.floor(12+3.6*Math.cos(angle)),Math.floor(12.5+2.4*Math.sin(angle)),'#b6aac2')
  }
  art.rect(4,18,16,1,'#e8e2d0').rect(4,19,16,2,WOOD_DEEP)
  for(const x of [6,9,12,15])art.set(x,19,'#fff1cf')
  art.set(18,19,lit?'#ef6b57':'#ad513f')
  art.rect(5,21,14,5,WOOD_DEEP).rect(6,22,12,1,'#8a5c3a').rect(6,24,12,1,'#8a5c3a')
  art.rect(1,27,22,2,WOOD_DEEP).rect(1,27,22,1,WOOD_DARK)
  return art.outline(INK).shadow(12,30,11,1)
}
export function musicNoteArt(){
  return new PixelArt(8,9).grid(1,1,['...cc.','...c.c','...c..','...c..','.ccc..','cccc..','.cc...'],{c:'#fff3d6'}).outline('#6b4630')
}

export function sparkleArt(){return new PixelArt(7,7).grid(0,0,['...c...','...c...','..ccc..','ccccccc','..ccc..','...c...','...c...'],{c:'#fff1cf'})}

// ---------- The room shell (walls, awning, sign, kitchen nook, chalkboard frame, floor) ----------
export const ROOM={width:180,height:290,floorTop:101,frontWall:274}
export function roomArt(){
  const art=new PixelArt(ROOM.width,ROOM.height)
  art.rect(0,0,180,290,'#f3e0bf')
  // Awning
  art.rect(0,0,180,3,'#6b4630').rect(0,3,180,1,'#83573a')
  for(let i=0;i<18;i++){
    const x=i*10,color=i%2?'#8e5c3c':'#f6dfb4'
    art.rect(x,4,10,7,color).rect(x+1,11,8,1,color).rect(x+2,12,6,1,color).rect(x,4,10,1,i%2?'#a26c48':'#fff0d2')
    art.set(x,11,'#6b4630').set(x+1,12,'#6b4630').rect(x+2,13,6,1,'#6b4630').set(x+8,12,'#6b4630').set(x+9,11,'#6b4630')
  }
  // Store sign
  art.box(6,14,168,23,'#7b5236','#4b301f').rect(7,15,166,1,'#946342').rect(7,33,166,3,'#6a442c')
  for(const [x,y,w] of [[20,20,30],[118,27,40],[70,23,22],[146,19,14]] as const)art.rect(x,y,w,1,'#714a30')
  for(const [x,y] of [[9,17],[170,17],[9,32],[170,32]] as const)art.set(x,y,'#c9a06c')
  art.rect(7,37,166,1,'#e2c69c')
  // Side windows
  for(const x of [0,174]){art.rect(x,40,6,74,'#b08458').rect(x+(x?1:0),41,5,72,'#b9e0ef').rect(x+(x?1:0),76,5,1,'#b08458').rect(x+(x?1:0),98,5,15,'#86b86f').rect(x+(x?1:0),96,3,3,'#6fa55a')}
  // Kitchen plaque
  art.box(30,39,44,9,'#6e4a31',INK).rect(31,40,42,1,'#86593b')
  // Kitchen nook
  art.rect(16,49,77,50,'#8d6646').rect(17,50,75,48,'#a77b54').rect(18,51,73,46,'#f8ead0').rect(18,51,73,2,'#e8d3b0')
  for(const y of [60,72]){art.rect(20,y,52,2,'#9c6e46').rect(20,y,52,1,'#b8875a').set(23,y+2,'#7a5233').set(68,y+2,'#7a5233')}
  art.box(22,54,9,6,'#fbf4e6','#9a8670').rect(23,56,7,1,'#d8ccb6').rect(23,58,7,1,'#d8ccb6')
  art.box(33,56,10,3,'#f3e9d6','#9a8670').box(34,58,8,2,'#f3e9d6','#9a8670')
  for(const x of [46,51,56]){art.box(x,54,4,6,'#e8d3a8','#8a6a4a').rect(x,53,4,1,'#9c5a3a')}
  art.box(62,52,9,8,'#9a5b3b','#5e3a26').rect(63,53,2,4,'#b8744d').rect(64,51,3,1,'#5e3a26')
  const jarFill=['#d98b4b','#7fae5e','#c9a14a','#d9785b','#a8c66c']
  jarFill.forEach((fill,i)=>{const x=22+i*6;art.box(x,65,5,7,'#f4e3c0','#8a6a4a').rect(x,64,5,1,'#b5764a').rect(x+1,68,3,3,fill)})
  art.box(54,64,10,8,'#d9b07a','#8a6a4a').rect(55,65,8,1,'#e8c690')
  art.rect(18,84,73,13,'#bdb4a8').rect(18,84,73,1,'#9d9488')
  for(let x=21;x<91;x+=6)art.rect(x,85,1,12,'#aaa195')
  art.rect(18,90,73,1,'#aaa195')
  art.box(75,53,15,41,'#80868e','#454a51').rect(76,54,1,39,'#a3a9b1').rect(76,66,13,1,'#5d636b').rect(88,57,1,6,'#3f444a').rect(88,69,1,8,'#3f444a')
  art.rect(79,56,3,3,'#f7e7b8').rect(83,59,3,3,'#bfe0a8').rect(80,71,3,4,'#f7e7b8')
  // Live orders chalkboard
  art.box(96,38,75,61,'#6b4630',INK).rect(98,40,71,57,'#8a5c3a').rect(100,42,67,53,'#22392f').rect(100,42,67,1,'#2c4a3d')
  for(const [x,y] of [[140,60],[112,88],[158,70],[124,66]] as const)art.set(x,y,'#2f4a3e')
  art.rect(103,49,59,1,'#e9dcc0').set(162,49,'#e9dcc0').set(161,48,'#e9dcc0').set(161,50,'#e9dcc0')
  art.rect(103,62,61,1,'#e9dcc0').set(102,62,'#9fb0a4').set(164,62,'#9fb0a4')
  // Baseboard and tiled floor
  art.rect(0,99,180,2,'#cfa97c')
  for(let y=ROOM.floorTop;y<ROOM.frontWall;y++)for(let x=0;x<180;x++)
    art.set(x,y,x%10===0||y%10===0?'#e2c49c':(Math.floor(x/10)+Math.floor(y/10))%2?'#ecd0a8':'#efd5ae')
  art.rect(36,129,116,2,'#dcbb8f').rect(10,118,26,2,'#dcbb8f')
  // Front wall with the doorway
  art.rect(0,274,180,16,'#b29a80').rect(0,274,180,1,'#8e7760').rect(0,275,180,1,'#c7b197').rect(0,286,180,4,'#9a836b')
  for(let y=274;y<290;y++)for(let x=62;x<118;x++)art.set(x,y,x%10===0||y%10===0?'#e2c49c':'#efd5ae')
  return art
}

// Small UI sprites shared with the DOM header and hint row.
export function uiSpriteArt(name:string):PixelArt|undefined{
  if(name==='cat-face')return new PixelArt(14,11).grid(0,0,CAT_HEAD,CAT_COLORS)
  if(name==='onay-face')return new PixelArt(14,11).grid(0,0,CAT_HEAD,ONAY_COLORS)
  if(name==='jukebox')return jukeboxArt(1)
  if(name.startsWith('head-')){const id=name.slice(5) as HeadId;return headArt(id)}
  // Walk cycle strip (stand, step, stand, step) using the same frames as the in-store visitors.
  if(name.startsWith('walk-')){
    const id=name.slice(5) as HeadId,strip=new PixelArt(80,26)
    ;(['idle','step1','idle','step2'] as const).forEach((frame,i)=>strip.stamp(visitorArt(id,frame),i*20,0))
    return strip
  }
}
