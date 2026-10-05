import type { Box } from './editor'
import { worldDimensions } from './geometry.ts'
export type DimensionKey='width'|'height'|'depth'
export function resizedFromFace(original:Box,key:DimensionKey,size:number,sign:number,direction:{x:number;y:number;z:number}):Box{
 const result={...original,[key]:Math.max(1,size)}
 if(original.type==='door'||original.type==='window'){
  if(key==='height'&&sign<0&&original.type==='window')result.y=original.y+original.height-result.height
  if(key==='width')result.offset=(original.offset??0)+sign*(result.width-original.width)/2
  return result
 }
 const delta=(result[key]-original[key])*sign/2
 const oldHeight=worldDimensions(original).height,newHeight=worldDimensions(result).height
 result.x=original.x+direction.x*delta;result.z=original.z+direction.z*delta
 result.y=original.y+oldHeight/2+direction.y*delta-newHeight/2
 return result
}
