import type { Box } from './editor'
export interface Dimensions {width:number;height:number;depth:number}
export function worldDimensions(object:Box):Dimensions{
 if(object.type==='door'||object.type==='window')return object.wall==='east'||object.wall==='west'?{width:object.depth,height:object.height,depth:object.width}:{width:object.width,height:object.height,depth:object.depth}
 const x=(object.rotationX??0)*Math.PI/180,y=(object.rotationY??0)*Math.PI/180,z=(object.rotationZ??0)*Math.PI/180
 const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z)
 return {width:Math.abs(c*e)*object.width+Math.abs(c*f)*object.height+Math.abs(d)*object.depth,height:Math.abs(a*f+b*d*e)*object.width+Math.abs(a*e-b*d*f)*object.height+Math.abs(b*c)*object.depth,depth:Math.abs(b*f-a*d*e)*object.width+Math.abs(b*e+a*d*f)*object.height+Math.abs(a*c)*object.depth}
}
export function normalizeAngle(angle:number){const normalized=((angle+180)%360+360)%360-180;return Math.abs(normalized)<1e-10?0:normalized}
