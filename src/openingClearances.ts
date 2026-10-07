import type { Box, Room } from './editor'
import { objectBounds } from './objectCollisions.ts'
import { groupChildren } from './groups.ts'

export type ClearanceKey='left'|'right'|'bottom'|'top'
export function openingClearances(opening:Box,room:Room,objects:Box[]){
 const horizontal=opening.wall==='north'||opening.wall==='south',axis=horizontal?'x':'z',normal=horizontal?'z':'x'
 const length=horizontal?room.width:room.depth,wall=(opening.wall==='north'||opening.wall==='west'?-1:1)*(horizontal?room.depth:room.width)/2
 const center=opening[axis],low=center-opening.width/2,high=center+opening.width/2,bottom=opening.y,top=bottom+opening.height
 const limits:{key:ClearanceKey;value:number;label:string}[]=[{key:'left',value:-length/2,label:horizontal?'Pared oeste':'Pared norte'},{key:'right',value:length/2,label:horizontal?'Pared este':'Pared sur'},{key:'bottom',value:0,label:'Suelo'},{key:'top',value:room.height,label:'Techo'}]
 const overlap=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c)>1e-7
 function visit(object:Box){
  if(object.children){groupChildren(object).forEach(visit);return}
  if(object.type!=='column'&&object.type!=='beam')return
  const bounds=objectBounds(object)
  if(bounds.min[normal]>wall+1||bounds.max[normal]<wall-1)return
  const a=bounds.min[axis],b=bounds.max[axis],y=bounds.min.y,t=bounds.max.y
  if(overlap(y,t,bottom,top)){
   if(b<=low+1e-7&&b>limits[0]!.value)Object.assign(limits[0]!,{value:b,label:object.name})
   if(a>=high-1e-7&&a<limits[1]!.value)Object.assign(limits[1]!,{value:a,label:object.name})
  }
  if(overlap(a,b,low,high)){
   if(t<=bottom+1e-7&&t>limits[2]!.value)Object.assign(limits[2]!,{value:t,label:object.name})
   if(y>=top-1e-7&&y<limits[3]!.value)Object.assign(limits[3]!,{value:y,label:object.name})
  }
 }
 objects.forEach(visit)
 const point=(along:number,y:number)=>horizontal?{x:along,y,z:wall}:{x:wall,y,z:along}
 return limits.map((limit,index)=>{
  const start=index<2?point(index===0?low:high,(bottom+top)/2):point(center,index===2?bottom:top)
  const end=index<2?point(limit.value,(bottom+top)/2):point(center,limit.value)
  return {key:limit.key,label:limit.label,start,end,value:Math.max(0,index===0?low-limit.value:index===1?limit.value-high:index===2?bottom-limit.value:limit.value-top)}
 })
}

