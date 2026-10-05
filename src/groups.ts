import { Quaternion, Euler, Vector3, MathUtils } from 'three'
import type { Box } from './editor.ts'
import { worldDimensions } from './geometry.ts'
import { objectBounds, isStructural } from './objectCollisions.ts'

export function cloneObject(object:Box,newIds=false):Box {
 const copy:Box=JSON.parse(JSON.stringify(object))
 function renew(o:Box){o.id=crypto.randomUUID();o.children?.forEach(renew)}
 if(newIds)renew(copy)
 return copy
}
export function makeGroup(members:Box[]):Box {
 const bounds=members.map(objectBounds)
 const min={x:Math.min(...bounds.map(b=>b.min.x)),y:Math.min(...bounds.map(b=>b.min.y)),z:Math.min(...bounds.map(b=>b.min.z))}
 const max={x:Math.max(...bounds.map(b=>b.max.x)),y:Math.max(...bounds.map(b=>b.max.y)),z:Math.max(...bounds.map(b=>b.max.z))}
 const size={width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}
 const x=(min.x+max.x)/2,z=(min.z+max.z)/2
 return {id:crypto.randomUUID(),name:'Grupo',type:'group',x,y:min.y,z,...size,color:members[0]!.color,collisions:members.some(o=>o.collisions!==false),groupSize:size,children:members.map(o=>({...cloneObject(o),x:o.x-x,y:o.y-min.y,z:o.z-z}))}
}
function orientation(o:Box){return new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(o.rotationX??0),MathUtils.degToRad(o.rotationY??0),MathUtils.degToRad(o.rotationZ??0),'XYZ'))}
export function groupChildren(group:Box):Box[]{
 const scale=group.width/group.groupSize!.width,q=orientation(group),center=new Vector3(group.x,group.y+worldDimensions(group).height/2,group.z)
 return group.children!.map(child=>{
  const dims=worldDimensions(child),position=new Vector3(child.x,child.y+dims.height/2-group.groupSize!.height/2,child.z).multiplyScalar(scale).applyQuaternion(q).add(center)
  const euler=new Euler().setFromQuaternion(q.clone().multiply(orientation(child)),'XYZ')
  const result:Box={...cloneObject(child),width:child.width*scale,height:child.height*scale,depth:child.depth*scale,rotationX:MathUtils.radToDeg(euler.x),rotationY:MathUtils.radToDeg(euler.y),rotationZ:MathUtils.radToDeg(euler.z),x:position.x,z:position.z,y:0}
  result.y=position.y-worldDimensions(result).height/2
  if(Math.abs(result.y)<1e-7)result.y=0
  return result
 })
}
export function recolorStructure(objects:Box[],color:string){
 for(const object of objects){if(object.children)recolorStructure(object.children,color);else if(isStructural(object))object.color=color}
}
export function validGroupScale(object:Box,parentScale=1):boolean{
 if(Math.min(object.width,object.height,object.depth)*parentScale<0.001-1e-10)return false
 return !object.children||object.children.every(child=>validGroupScale(child,parentScale*object.width/object.groupSize!.width))
}
// Group members use local millimetres; the outer box always scales uniformly.
export function validateGroups(objects:Box[]):Box[]{
 const all:Box[]=[]
 function visit(o:Box,depth:number){
  if(!o||typeof o!=='object'||depth>20||all.length>=1000)throw Error()
  all.push(o)
  if(o.type!=='group'){if(o.children!==undefined||o.groupSize!==undefined)throw Error();return}
  if(!Array.isArray(o.children)||o.children.length<2||!o.groupSize)throw Error()
  for(const key of ['width','height','depth'] as const)if(typeof o.groupSize[key]!=='number'||!Number.isFinite(o.groupSize[key])||o.groupSize[key]<0.001||Math.abs(o[key]/o.groupSize[key]-o.width/o.groupSize.width)>1e-6)throw Error()
  for(const child of o.children){visit(child,depth+1);if(child.type==='door'||child.type==='window')throw Error()}
  const bounds=o.children.map(objectBounds)
  if(bounds.some(b=>b.min.x < -o.groupSize!.width/2-1e-5||b.max.x>o.groupSize!.width/2+1e-5||b.min.y< -1e-5||b.max.y>o.groupSize!.height+1e-5||b.min.z< -o.groupSize!.depth/2-1e-5||b.max.z>o.groupSize!.depth/2+1e-5))throw Error()
 }
 objects.forEach(o=>visit(o,0))
 return all
}
