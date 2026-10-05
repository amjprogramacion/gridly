import type { Box, Room } from './editor'
import { Euler, Quaternion, Vector3, MathUtils } from 'three'
import { worldDimensions } from './geometry.ts'
export const COLLISION_EPS=1e-7
export function isStructural(object:Box){return object.type==='beam'||object.type==='column'||!!object.children?.some(isStructural)}
export function objectBounds(object:Box){
 const {width,height,depth}=worldDimensions(object)
 return {min:{x:object.x-width/2,y:object.y,z:object.z-depth/2},max:{x:object.x+width/2,y:object.y+height,z:object.z+depth/2}}
}
export function participates(object:Box,room:Room|null){
 return (isStructural(object)||object.collisions!==false)&&(!(object.type==='door'||object.type==='window')||!room||!!room.walls[object.wall!])
}
export function collisionPeers(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return objects.filter(other=>other.id!==object.id&&
  ((isStructural(object)||isStructural(other))&&!((object.type==='beam'||object.type==='column')&&(other.type==='beam'||other.type==='column'))||!isStructural(object)&&!isStructural(other)&&enabled&&object.collisions!==false&&other.collisions!==false)&&
  (!(object.type==='door'||object.type==='window')||!room||!!room.walls[object.wall!])&&
  (!(other.type==='door'||other.type==='window')||!room||!!room.walls[other.wall!]))
}
function orientedBox(o:Box){
  const opening=o.type==='door'||o.type==='window'
  const q=new Quaternion().setFromEuler(opening?new Euler(0,o.wall==='east'||o.wall==='west'?Math.PI/2:0,0):new Euler(MathUtils.degToRad(o.rotationX??0),MathUtils.degToRad(o.rotationY??0),MathUtils.degToRad(o.rotationZ??0),'XYZ'))
  return {center:new Vector3(o.x,o.y+worldDimensions(o).height/2,o.z),axes:[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)].map(v=>v.applyQuaternion(q)),half:[o.width/2,o.height/2,o.depth/2]}
}
function separatingAxes(first:ReturnType<typeof orientedBox>,second:ReturnType<typeof orientedBox>){
 return [...first.axes,...second.axes,...first.axes.flatMap(x=>second.axes.map(y=>x.clone().cross(y)))].filter(v=>v.lengthSq()>1e-16).map(v=>v.normalize())
}
function projectedRadius(shape:ReturnType<typeof orientedBox>,axis:Vector3){return shape.axes.reduce((sum,direction,i)=>sum+Math.abs(direction.dot(axis))*shape.half[i]!,0)}
export function boundsOverlap(a:Box,b:Box){
 const left=objectBounds(a),right=objectBounds(b)
 return (['x','y','z'] as const).every(axis=>Math.min(left.max[axis],right.max[axis])-Math.max(left.min[axis],right.min[axis])>COLLISION_EPS)
}
export function overlaps(a:Box,b:Box){
 if(!boundsOverlap(a,b))return false
 // Avoid false overlaps between adjacent rotated group components.
 const first=orientedBox(a),second=orientedBox(b),delta=second.center.clone().sub(first.center)
 return separatingAxes(first,second).every(axis=>projectedRadius(first,axis)+projectedRadius(second,axis)-Math.abs(delta.dot(axis))>COLLISION_EPS)
}
// Continuous narrow phase when two rotated boxes already share a broad-phase
// envelope at the start. The usual AABB sweep cannot detect these entries.
export function orientedSweep(a:Box,b:Box,delta:{x:number;y:number;z:number}):number|null{
 const first=orientedBox(a),second=orientedBox(b),offset=first.center.clone().sub(second.center),velocity=new Vector3(delta.x,delta.y,delta.z)
 let entry=-Infinity,exit=Infinity
 for(const axis of separatingAxes(first,second)){
  const radius=projectedRadius(first,axis)+projectedRadius(second,axis),position=offset.dot(axis),speed=velocity.dot(axis)
  if(Math.abs(speed)<1e-10){if(Math.abs(position)>=radius-COLLISION_EPS)return null;continue}
  const t1=(-radius-position)/speed,t2=(radius-position)/speed
  entry=Math.max(entry,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2))
  if(exit<=Math.max(entry,0)+1e-10)return null
 }
 return entry>=-1e-10&&entry<1?Math.max(0,entry):null
}
export function intersectsObjects(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return collisionPeers(object,objects,room,enabled).some(other=>overlaps(object,other))
}
export function hasObjectCollisions(objects:Box[],room:Room|null,enabled:boolean){
 return objects.some((object,index)=>collisionPeers(object,objects.slice(index+1),room,enabled).some(other=>overlaps(object,other)))
}
