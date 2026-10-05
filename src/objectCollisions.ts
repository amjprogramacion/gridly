import type { Box, Room } from './editor'
import { worldDimensions } from './geometry.ts'
export const COLLISION_EPS=1e-7
export function isStructural(object:Box){return object.type==='beam'||object.type==='column'}
export function objectBounds(object:Box){
 const {width,height,depth}=worldDimensions(object)
 return {min:{x:object.x-width/2,y:object.y,z:object.z-depth/2},max:{x:object.x+width/2,y:object.y+height,z:object.z+depth/2}}
}
export function participates(object:Box,room:Room|null){
 return (isStructural(object)||object.collisions!==false)&&(!(object.type==='door'||object.type==='window')||!room||!!room.walls[object.wall!])
}
export function collisionPeers(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return objects.filter(other=>other.id!==object.id&&
  (isStructural(object)!==isStructural(other)||!isStructural(object)&&!isStructural(other)&&enabled&&object.collisions!==false&&other.collisions!==false)&&
  (!(object.type==='door'||object.type==='window')||!room||!!room.walls[object.wall!])&&
  (!(other.type==='door'||other.type==='window')||!room||!!room.walls[other.wall!]))
}
export function overlaps(a:Box,b:Box){
 const left=objectBounds(a),right=objectBounds(b)
 return (['x','y','z'] as const).every(axis=>Math.min(left.max[axis],right.max[axis])-Math.max(left.min[axis],right.min[axis])>COLLISION_EPS)
}
export function intersectsObjects(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return collisionPeers(object,objects,room,enabled).some(other=>overlaps(object,other))
}
export function hasObjectCollisions(objects:Box[],room:Room|null,enabled:boolean){
 return objects.some((object,index)=>collisionPeers(object,objects.slice(index+1),room,enabled).some(other=>overlaps(object,other)))
}
