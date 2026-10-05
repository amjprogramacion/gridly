import { shallowRef, reactive, onBeforeUnmount } from 'vue'
import * as T from 'three'
import { state, selected, isOpening, checkpoint, moveSelected, beginRotation, endRotation, rotateSelected, edit, resizeSelectedFromFace, type Box } from './editor'
import type { DimensionKey } from './faceResize'
type Point={x:number;y:number}
type Handle={key:DimensionKey;sign:number;point:Point;direction:T.Vector3;screen:Point}
type Measure={key:DimensionKey;label:string;start:Point;end:Point;point:Point;value:number}
type RotationControl={axis:'X'|'Y'|'Z';point:Point;path:string;tangent:Point;color:string}
interface Overlay{outline:string;handles:Handle[];measures:Measure[];base:Point;lift:Point;rotations:RotationControl[];visible:boolean;opening:boolean}
interface Drag{kind:'resize'|'move'|'lift'|'rotate';original:Box;start:Point;handle?:Handle;rotation?:'rotationX'|'rotationY'|'rotationZ';tangent?:Point;plane?:T.Plane;anchor?:T.Vector3;target:HTMLElement;pointer:number}
export function useObjectControls(setInteraction:(active:boolean)=>void){
 const overlay=shallowRef<Overlay|null>(null)
 const drafts=reactive<Partial<Record<DimensionKey,string>>>({})
 const rotationInteraction=reactive({hovered:null as 'X'|'Y'|'Z'|null,dragging:null as 'X'|'Y'|'Z'|null})
 let camera:T.PerspectiveCamera,mesh:T.Group,width=1,height=1,rect:DOMRect,drag:Drag|null=null
 function project(point:T.Vector3):Point{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2}}
 function local(x:number,y:number,z:number){return mesh.localToWorld(new T.Vector3(x,y,z))}
 function update(cam:T.PerspectiveCamera,active:T.Group|undefined,w:number,h:number,bounds:DOMRect){
  const object=selected.value;if(!object||!active||!active.visible){overlay.value=null;return}
  camera=cam;mesh=active;width=w;height=h;rect=bounds;mesh.updateWorldMatrix(true,false)
  const opening=isOpening(object),cx=object.width/2000,cz=object.depth/2000,bottom=opening?0:-object.height/2000,top=bottom+object.height/1000,cy=(bottom+top)/2
  const corners=[local(-cx,bottom,-cz),local(cx,bottom,-cz),local(cx,bottom,cz),local(-cx,bottom,cz),local(-cx,top,-cz),local(cx,top,-cz),local(cx,top,cz),local(-cx,top,cz)].map(project)
  const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
  const outline=edges.map(([a,b])=>`M${corners[a!]!.x},${corners[a!]!.y}L${corners[b!]!.x},${corners[b!]!.y}`).join(' ')
  const center=local(0,cy,0),orientation=mesh.getWorldQuaternion(new T.Quaternion())
  const handles:Handle[]=[]
  for(const key of ['width','height','depth'] as DimensionKey[])for(const sign of [-1,1]){
   const direction=new T.Vector3(key==='width'?1:0,key==='height'?1:0,key==='depth'?1:0).applyQuaternion(orientation)
   const face=center.clone().addScaledVector(direction,object[key]/2000*sign),point=project(face),next=project(face.clone().addScaledVector(direction,1))
   handles.push({key,sign,point,direction,screen:{x:next.x-point.x,y:next.y-point.y}})
  }
  const makeMeasure=(key:DimensionKey,label:string,start:T.Vector3,end:T.Vector3):Measure=>{const a=project(start),b=project(end);return {key,label,start:a,end:b,point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},value:object[key]}}
  const offset=.18
  const measures=[makeMeasure('width','Anchura',local(-cx,bottom,cz+offset),local(cx,bottom,cz+offset)),makeMeasure('depth','Profundidad',local(cx+offset,bottom,-cz),local(cx+offset,bottom,cz)),makeMeasure('height','Altura',local(cx+offset,bottom,cz+offset),local(cx+offset,top,cz+offset))]
  const topPoint=project(local(0,top,0)),base=project(new T.Vector3(object.x/1000,object.y/1000,object.z/1000))
  const radius=Math.max(cx,cz,object.height/2000)+.65
  const rotations:RotationControl[]=(['X','Y','Z'] as const).map((axis,index)=>{
   // XYZ Euler axes include the preceding rotations, matching the model fields.
   const basis=new T.Quaternion().setFromEuler(new T.Euler(axis==='X'?0:T.MathUtils.degToRad(object.rotationX??0),axis==='Z'?T.MathUtils.degToRad(object.rotationY??0):0,0,'XYZ'))
   const ring=(angle:number)=>{const a=Math.cos(angle)*radius,b=Math.sin(angle)*radius,vector=axis==='X'?new T.Vector3(0,a,b):axis==='Y'?new T.Vector3(b,0,a):new T.Vector3(a,b,0);return project(center.clone().add(vector.applyQuaternion(basis)))}
   // Anchor on the corresponding local face, away from its resize handle.
   // These positions stay attached to the piece as the camera and piece rotate.
   const point=project(axis==='X'?local(cx+.02,cy+object.height/4000,0):axis==='Y'?local(cx*.55,top+.02,cz*.55):local(-cx*.55,cy+object.height/4000,cz+.02))
   const angle=Math.PI/2
   const ringPoint=ring(angle),next=ring(angle+.02),length=Math.hypot(next.x-ringPoint.x,next.y-ringPoint.y)||1
   const points=Array.from({length:65},(_,i)=>ring(i*Math.PI/32))
   return {axis,point,path:points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '),tangent:{x:(next.x-ringPoint.x)/length,y:(next.y-ringPoint.y)/length},color:['#f49b92','#9cdbab','#91bfff'][index]!}
  })
  const occupied=rotations.map(r=>({x:r.point.x,y:r.point.y,w:46,h:40})).concat(handles.map(h=>({x:h.point.x,y:h.point.y,w:20,h:20})),[{x:base.x,y:base.y,w:30,h:30},{x:topPoint.x,y:topPoint.y-24,w:30,h:30}])
  for(const measure of measures){
   measure.point.x+=measure.key==='width'?0:60;measure.point.y+=measure.key==='width'?28:measure.key==='depth'?16:0
   measure.point.x=Math.max(52,Math.min(width-52,measure.point.x));measure.point.y=Math.max(24,Math.min(height-24,measure.point.y))
   for(let i=0;i<30;i++){const overlap=occupied.find(r=>Math.abs(measure.point.x-r.x)<(96+r.w)/2+5&&Math.abs(measure.point.y-r.y)<(40+r.h)/2+5);if(!overlap)break;measure.point.y=overlap.y+(40+overlap.h)/2+6;if(measure.point.y>height-24){measure.point.y=24;measure.point.x=Math.max(52,measure.point.x-105)}}
   occupied.push({x:measure.point.x,y:measure.point.y,w:96,h:40})
  }
  overlay.value={outline,handles,measures,base,lift:{x:topPoint.x,y:topPoint.y-24},rotations,visible:center.clone().project(camera).z<1,opening}
 }
 function cursor(e:PointerEvent){return {x:e.clientX-rect.left,y:e.clientY-rect.top}}
 function rayPoint(point:Point,plane:T.Plane){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(point.x/width*2-1,1-point.y/height*2),camera);return ray.ray.intersectPlane(plane,new T.Vector3())}
 function start(e:PointerEvent,kind:Drag['kind'],handle?:Handle,rotation?:Drag['rotation'],tangent?:Point){
  if(e.button!==0||!selected.value)return;e.preventDefault();e.stopPropagation()
  const original={...selected.value},point=cursor(e),target=e.currentTarget as HTMLElement
  if(kind==='rotate')beginRotation();else checkpoint()
  drag={kind,original,start:point,handle,rotation,tangent,target,pointer:e.pointerId}
  rotationInteraction.dragging=kind==='rotate'&&rotation?rotation.slice(-1) as 'X'|'Y'|'Z':null
  if(kind==='move'){drag.plane=new T.Plane(new T.Vector3(0,1,0),-original.y/1000);drag.anchor=rayPoint(point,drag.plane)??undefined}
  target.setPointerCapture(e.pointerId);setInteraction(true)
 }
 function move(e:PointerEvent){
  if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();const point=cursor(e),dx=point.x-drag.start.x,dy=point.y-drag.start.y,o=drag.original
  if(drag.kind==='resize'&&drag.handle){const handle=drag.handle,den=handle.screen.x**2+handle.screen.y**2;if(den<1)return;const delta=(dx*handle.screen.x+dy*handle.screen.y)/den*1000*handle.sign;resizeSelectedFromFace(o,handle.key,o[handle.key]+delta,handle.sign,handle.direction)}
  else if(drag.kind==='move'&&drag.plane&&drag.anchor){const current=rayPoint(point,drag.plane);if(current){const delta=current.sub(drag.anchor);moveSelected(o.x+delta.x*1000,o.y,o.z+delta.z*1000,['x','z'])}}
  else if(drag.kind==='lift'){const base=new T.Vector3(o.x/1000,o.y/1000,o.z/1000),a=project(base),b=project(base.clone().add(new T.Vector3(0,1,0))),sx=b.x-a.x,sy=b.y-a.y,den=sx*sx+sy*sy;if(den>1)moveSelected(o.x,o.y+(dx*sx+dy*sy)/den*1000,o.z,['y'])}
  else if(drag.kind==='rotate'&&drag.rotation){const distance=drag.tangent?dx*drag.tangent.x+dy*drag.tangent.y:dx;let angle=(o[drag.rotation]??0)+distance*.6;if(state.snap)angle=Math.round(angle/15)*15;rotateSelected({rotationX:o.rotationX,rotationY:o.rotationY,rotationZ:o.rotationZ,[drag.rotation]:angle})}
 }
 function finish(e?:PointerEvent){if(!drag||e&&e.pointerId!==drag.pointer)return;const old=drag;drag=null;rotationInteraction.dragging=null;if(old.target.hasPointerCapture(old.pointer))old.target.releasePointerCapture(old.pointer);endRotation();setInteraction(false)}
 function changeMeasure(e:Event,key:DimensionKey){edit(key,(e.target as HTMLInputElement).value,false);delete drafts[key];(e.target as HTMLInputElement).value=String(selected.value?.[key]??'')}
 onBeforeUnmount(()=>finish())
 return {overlay,drafts,rotationInteraction,update,start,move,finish,changeMeasure}
}
