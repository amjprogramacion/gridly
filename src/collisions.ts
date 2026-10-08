import type { Box, Room, WallSide } from './editor'
import { collisionPeers, collisionPairs, objectBounds, intersectsObjects, boundsOverlap, overlaps, orientedSweep } from './objectCollisions.ts'
import { worldDimensions } from './geometry.ts'
import type { Axis, Position } from './snapping'
const axes:Axis[]=['x','y','z']
const EPS=1e-7
interface Bounds {min:Position;max:Position;side?:WallSide}
/** Closed doors and glazing also block passage through their wall's openings. */
function walls(room:Room):Bounds[]{
 const w=room.width/2,d=room.depth/2,t=room.thickness,h=room.height,result:Bounds[]=[]
 if(room.walls.west)result.push({side:'west',min:{x:-w-t,y:0,z:-d},max:{x:-w,y:h,z:d}})
 if(room.walls.east)result.push({side:'east',min:{x:w,y:0,z:-d},max:{x:w+t,y:h,z:d}})
 if(room.walls.north)result.push({side:'north',min:{x:-w-t,y:0,z:-d-t},max:{x:w+t,y:h,z:-d}})
 if(room.walls.south)result.push({side:'south',min:{x:-w-t,y:0,z:d},max:{x:w+t,y:h,z:d+t}})
 return result
}
export function intersectsWall(object:Box,room:Room|null){
 if(!room)return false
 const opening=object.type==='door'||object.type==='window';const {width,height,depth}=worldDimensions(object)
 const min={x:object.x-width/2,y:object.y,z:object.z-depth/2},max={x:object.x+width/2,y:object.y+height,z:object.z+depth/2}
 return walls(room).some(wall=>(!opening||wall.side!==object.wall)&&axes.every(axis=>Math.min(max[axis],wall.max[axis])-Math.max(min[axis],wall.min[axis])>EPS))
}
/** The virtual ceiling remains active independently of the wall toggles. */
export function intersectsRoom(object:Box,room:Room|null){
 return !!room&&(object.y+worldDimensions(object).height>room.height+EPS||intersectsWall(object,room))
}
function expanded(wall:Bounds,object:Box):Bounds{const {width,height,depth}=worldDimensions(object);return {min:{x:wall.min.x-width/2,y:wall.min.y-height,z:wall.min.z-depth/2},max:{x:wall.max.x+width/2,y:wall.max.y,z:wall.max.z+depth/2}}}
function sweep(from:Position,delta:Position,bounds:Bounds){
 let entry=-Infinity,exit=Infinity;let hitAxes:Axis[]=[]
 for(const axis of axes){
  if(Math.abs(delta[axis])<EPS){if(from[axis]<=bounds.min[axis]+EPS||from[axis]>=bounds.max[axis]-EPS)return null;continue}
  const a=(bounds.min[axis]-from[axis])/delta[axis],b=(bounds.max[axis]-from[axis])/delta[axis],near=Math.min(a,b),far=Math.max(a,b)
  if(near>entry+EPS){entry=near;hitAxes=[axis]}else if(Math.abs(near-entry)<EPS)hitAxes.push(axis)
  exit=Math.min(exit,far)
 }
 if(entry<-EPS||entry>1+EPS||exit<=Math.max(entry,0)+EPS)return null
 return {time:Math.max(0,entry),axes:hitAxes,planes:Object.fromEntries(hitAxes.map(axis=>[axis,delta[axis]>0?bounds.min[axis]:bounds.max[axis]])) as Partial<Position>}
}
/** Continuous collision detection prevents crossing walls or other elements in one large drag step. */
export function limitMovement(object:Box,room:Room|null,target:Position,objects:Box[]=[],collisions=false){
 let position:Position={x:object.x,y:object.y,z:object.z};let delta:Position={x:target.x-position.x,y:Math.max(0,target.y)-position.y,z:target.z-position.z};let blocked=false
 const opening=object.type==='door'||object.type==='window'
 const obstacles=room?walls(room).filter(w=>!opening||w.side!==object.wall).map(w=>expanded(w,object)):[]
 if(room)obstacles.push({min:{x:-Infinity,y:room.height-worldDimensions(object).height,z:-Infinity},max:{x:Infinity,y:Infinity,z:Infinity}})
 const peers=collisionPeers(object,objects,room,collisions)
 obstacles.push(...peers.flatMap(other=>collisionPairs(object,other)).map(([shape,peer])=>{
  const bounds=expanded(objectBounds(peer),shape)
  for(const axis of axes){bounds.min[axis]-=shape[axis]-object[axis];bounds.max[axis]-=shape[axis]-object[axis]}
  return bounds
 }))
 for(let iteration=0;iteration<4;iteration++){
  const current={...object,...position}
  const narrowTime=peers.flatMap(other=>collisionPairs(current,other)).filter(([a,b])=>boundsOverlap(a,b)&&!overlaps(a,b)).reduce((time,[a,b])=>Math.min(time,orientedSweep(a,b,delta)??Infinity),Infinity)
  const hits=obstacles.map(w=>sweep(position,delta,w)).filter(h=>h!==null)
  const time=hits.reduce((t,h)=>Math.min(t,h.time),Infinity)
  if(narrowTime<time){for(const axis of axes)position[axis]+=delta[axis]*narrowTime;blocked=true;break}
  if(!Number.isFinite(time)){for(const axis of axes)position[axis]+=delta[axis];break}
  blocked=true;for(const axis of axes)position[axis]+=delta[axis]*time
  const tied=hits.filter(h=>Math.abs(h.time-time)<EPS);const hitAxes=new Set(tied.flatMap(h=>h.axes));for(const hit of tied)for(const axis of hit.axes)position[axis]=hit.planes[axis]!
  for(const axis of axes)delta[axis]=hitAxes.has(axis)?0:delta[axis]*(1-time)
  if(axes.every(axis=>Math.abs(delta[axis])<EPS))break
 }
 if(intersectsRoom({...object,...position},room)||intersectsObjects({...object,...position},objects,room,collisions))return {position:{x:object.x,y:object.y,z:object.z},blocked:true}
 return {position,blocked}
}
/** Reposition objects when walls move; reject a room edit if an object's size cannot fit. */
export function fitRoomObject(object:Box,room:Room){
 if(object.type==='door'||object.type==='window')return !intersectsRoom(object,room)
 const {width,height,depth}=worldDimensions(object)
 if(height>room.height+EPS)return false
 object.y=Math.min(Math.max(0,room.height-height),Math.max(0,object.y))
 const minX=room.walls.west?-room.width/2+width/2:-Infinity,maxX=room.walls.east?room.width/2-width/2:Infinity
 const minZ=room.walls.north?-room.depth/2+depth/2:-Infinity,maxZ=room.walls.south?room.depth/2-depth/2:Infinity
 if(minX>maxX+EPS||minZ>maxZ+EPS)return false
 object.x=Math.min(maxX,Math.max(minX,object.x));object.z=Math.min(maxZ,Math.max(minZ,object.z))
 return !intersectsRoom(object,room)
}
