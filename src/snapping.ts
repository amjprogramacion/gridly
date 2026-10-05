import type { Box, Room, WallSide } from './editor'
import { worldDimensions } from './geometry.ts'
import { wallPanels } from './walls.ts'
export type Axis = 'x' | 'y' | 'z'
export type Position = Pick<Box, 'x' | 'y' | 'z'>
export const WALL_SNAP_DISTANCE = 60 // mm, independent of the grid step
export interface SnapContact { axis:Axis; label:string; target:number }
const names:Record<WallSide,string>={north:'Pared norte',south:'Pared sur',west:'Pared oeste',east:'Pared este'}
const overlap=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c)>0.001

/** Only actual solid wall panels attract the object; openings remain empty. */
export function wallCandidates(object:Box,room:Room,objects:Box[],position:Position):SnapContact[]{
 const contacts:SnapContact[]=[]
 const {width,height,depth}=worldDimensions(object)
 for(const side of ['west','east','north','south'] as WallSide[]){
  if(!room.walls[side])continue
  const axis:Axis=side==='west'||side==='east'?'x':'z',size=axis==='x'?width:depth,roomSize=axis==='x'?room.width:room.depth
  if(size>roomSize)continue
  const along=axis==='x'?position.z:position.x,alongSize=axis==='x'?depth:width,length=axis==='x'?room.depth:room.width
  const touchesSolid=wallPanels(room,side,objects).some(panel=>overlap(along-alongSize/2,along+alongSize/2,panel.start-length/2,panel.start+panel.width-length/2)&&overlap(position.y,position.y+height,panel.bottom,panel.bottom+panel.height))
  if(!touchesSolid)continue
  contacts.push({axis,label:names[side],target:(side==='west'||side==='north'?-1:1)*(roomSize-size)/2})
 }
 const insideFloor=overlap(position.x-width/2,position.x+width/2,-room.width/2,room.width/2)&&overlap(position.z-depth/2,position.z+depth/2,-room.depth/2,room.depth/2)
 if(insideFloor){contacts.push({axis:'y',label:'Suelo',target:0});if(height<=room.height)contacts.push({axis:'y',label:'Techo virtual',target:room.height-height})}
 return contacts
}
export function snapPosition(object:Box,room:Room|null,objects:Box[],raw:Position,options:{enabled:boolean;walls:boolean;step:number;axes:Axis[];grid?:boolean}){
 const position={...raw},contacts:SnapContact[]=[]
 const candidates=options.enabled&&options.walls&&room&&object.type!=='door'&&object.type!=='window'?wallCandidates(object,room,objects,raw):[]
 for(const axis of options.axes){
  const nearest=candidates.filter(c=>c.axis===axis&&Math.abs(c.target-raw[axis])<=WALL_SNAP_DISTANCE).sort((a,b)=>Math.abs(a.target-raw[axis])-Math.abs(b.target-raw[axis]))[0]
  if(nearest){position[axis]=nearest.target;contacts.push(nearest)}
  else if(options.enabled&&options.grid!==false&&options.step>0)position[axis]=Math.round(raw[axis]/options.step)*options.step
 }
 position.y=Math.max(0,position.y)
 return {position,contacts}
}
export function touchingWalls(object:Box,room:Room|null,objects:Box[]){
 if(!room||object.type==='door'||object.type==='window')return []
 return wallCandidates(object,room,objects,object).filter(c=>Math.abs(object[c.axis]-c.target)<.01)
}
