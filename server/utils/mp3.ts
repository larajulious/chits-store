// Reads an MP3's real duration from its frame headers, without decoding audio or adding a dependency.
// Uses the Xing/Info or VBRI summary when the encoder wrote one, otherwise counts every frame.
const BITRATES={
  v1l1:[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
  v1l2:[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
  v1l3:[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
  v2l1:[0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
  v2l23:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
}
const SAMPLE_RATES={1:[44100,48000,32000],2:[22050,24000,16000],2.5:[11025,12000,8000]}
type Frame={length:number;samples:number;sampleRate:number;version:1|2|2.5;mono:boolean}

function frameAt(bytes:Buffer,i:number):Frame|null{
  if(i+4>bytes.length||bytes[i]!==0xff||(bytes[i+1]!&0xe0)!==0xe0)return null
  const versionBits=(bytes[i+1]!>>3)&3,layerBits=(bytes[i+1]!>>1)&3
  const bitrateIndex=bytes[i+2]!>>4,rateIndex=(bytes[i+2]!>>2)&3,padding=(bytes[i+2]!>>1)&1
  if(versionBits===1||layerBits===0||bitrateIndex===0||bitrateIndex===15||rateIndex===3)return null
  const version=versionBits===3?1:versionBits===2?2:2.5,layer=4-layerBits
  const table=version===1?(layer===1?BITRATES.v1l1:layer===2?BITRATES.v1l2:BITRATES.v1l3):(layer===1?BITRATES.v2l1:BITRATES.v2l23)
  const bitrate=table[bitrateIndex]!*1000,sampleRate=SAMPLE_RATES[version][rateIndex]!
  const samples=layer===1?384:layer===3&&version!==1?576:1152
  const length=layer===1?Math.floor(12*bitrate/sampleRate+padding)*4:Math.floor(samples/8*bitrate/sampleRate)+padding
  return length>4?{length,samples,sampleRate,version,mono:bytes[i+3]!>>6===3}:null
}

function firstFrame(bytes:Buffer){
  let start=0
  // ID3v2 tag: 10-byte header, a syncsafe size, and an optional 10-byte footer.
  if(bytes.length>10&&bytes.toString('latin1',0,3)==='ID3'){
    start=10+((bytes[6]!&0x7f)<<21|(bytes[7]!&0x7f)<<14|(bytes[8]!&0x7f)<<7|(bytes[9]!&0x7f))+(bytes[5]!&0x10?10:0)
  }
  // Two consecutive valid headers rule out a stray 0xFF in tag padding or album art.
  for(let i=start;i<Math.min(bytes.length,start+64*1024);i++){
    const frame=frameAt(bytes,i)
    if(frame&&frameAt(bytes,i+frame.length))return {offset:i,frame}
  }
  return null
}

export function mp3DurationMs(bytes:Buffer):number|null{
  const first=firstFrame(bytes)
  if(!first)return null
  const {offset,frame}=first
  const sideInfo=frame.version===1?(frame.mono?17:32):(frame.mono?9:17)
  const xing=offset+4+sideInfo
  const tag=bytes.toString('latin1',xing,xing+4)
  if((tag==='Xing'||tag==='Info')&&xing+12<=bytes.length&&bytes.readUInt32BE(xing+4)&1){
    const frames=bytes.readUInt32BE(xing+8)
    if(frames>0)return Math.round(frames*frame.samples/frame.sampleRate*1000)
  }
  const vbri=offset+36
  if(bytes.toString('latin1',vbri,vbri+4)==='VBRI'&&vbri+18<=bytes.length){
    const frames=bytes.readUInt32BE(vbri+14)
    if(frames>0)return Math.round(frames*frame.samples/frame.sampleRate*1000)
  }
  let samples=0,i=offset,current:Frame|null=frame
  while(current&&i+current.length<=bytes.length){
    samples+=current.samples/current.sampleRate
    i+=current.length
    current=frameAt(bytes,i)
  }
  return samples>0?Math.round(samples*1000):null
}
