import type { Box, Room } from './editor'
import { worldDimensions } from './geometry.ts'
export const COLLISION_EPS=1e-7
export function objectBounds(object:Box){
 const {width,height,depth}=worldDimensions(object)
 return {min:{x:object.x-width/2,y:object.y,z:object.z-depth/2},max:{x:object.x+width/2,y:object.y+height,z:object.z+depth/2}}
}
export function participates(object:Box,room:Room|null){
 return object.collisions!==false&&(!(object.type==='door'||object.type==='window')||!room||!!room.walls[object.wall!])
}
export function collisionPeers(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return enabled&&participates(object,room)?objects.filter(other=>other.id!==object.id&&participates(other,room)):[]
}
export function overlaps(a:Box,b:Box){
 const left=objectBounds(a),right=objectBounds(b)
 return (['x','y','z'] as const).every(axis=>Math.min(left.max[axis],right.max[axis])-Math.max(left.min[axis],right.min[axis])>COLLISION_EPS)
}
export function intersectsObjects(object:Box,objects:Box[],room:Room|null,enabled:boolean){
 return collisionPeers(object,objects,room,enabled).some(other=>overlaps(object,other))
}
export function hasObjectCollisions(objects:Box[],room:Room|null,enabled:boolean){
 if(!enabled)return false
 const active=objects.filter(object=>participates(object,room))
 return active.some((object,index)=>active.slice(index+1).some(other=>overlaps(object,other)))
}
