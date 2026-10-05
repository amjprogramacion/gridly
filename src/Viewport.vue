<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { state, selected, selection, selectObject, checkpoint, isOpening, moveSelected, rotateSelected, beginRotation, endRotation, type Box, type WallSide } from './editor'
import { groupChildren } from './groups'
import { worldDimensions } from './geometry'
import { wallPanels, visibleWallSides, wallPanelVisible, type WallPanel } from './walls'
import { useObjectControls } from './useObjectControls'
import { createCameraMotion } from './cameraMotion'
import { projectSelectionOutline } from './selectionOutline'
import type { Axis } from './snapping'
const host=ref<HTMLDivElement>();const error=ref('');const cameraMoving=ref(false)
const additionalOutlines=shallowRef<{id:string;path:string}[]>([])
let cameraInteracting=false,previousFrameTime=0
const trackCameraMotion=createCameraMotion(),previousCameraPosition=new T.Vector3(),previousCameraRotation=new T.Quaternion()
const controls=useObjectControls(active=>{if(orbit)orbit.enabled=!active});const overlay=controls.overlay
let renderer:T.WebGLRenderer,orbit:OrbitControls,transform:TransformControls,observer:ResizeObserver,camera:T.PerspectiveCamera
const scene=new T.Scene(),roomGroup=new T.Group();scene.add(roomGroup)
const roomWalls:{mesh:T.Mesh;side:WallSide;panel:WallPanel}[]=[]
const normals:Record<WallSide,T.Vector3>={north:new T.Vector3(0,0,-1),south:new T.Vector3(0,0,1),west:new T.Vector3(-1,0,0),east:new T.Vector3(1,0,0)}
let roomSignature='',syncing=false
const meshes=new Map<string,T.Group>();const signatures=new Map<string,string>()
function dispose(obj:T.Object3D){obj.traverse(child=>{if(child instanceof T.Mesh){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(m=>m.dispose())}})}
function piece(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:string,id:string,glass=false){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:glass?.15:.8,transparent:glass,opacity:glass?.3:1,depthWrite:!glass}));mesh.position.set(x,y,z);mesh.castShadow=!glass;mesh.receiveShadow=true;mesh.userData.id=id;parent.add(mesh);return mesh
}
function syncRoom(){
 const signature=JSON.stringify([state.room,state.structuralColor,state.objects.filter(isOpening)]);if(signature===roomSignature)return;roomSignature=signature
 for(const child of [...roomGroup.children]){roomGroup.remove(child);dispose(child)}roomWalls.length=0
 if(!state.room)return
 const r=state.room,w=r.width/1000,d=r.depth/1000,t=r.thickness/1000
 piece(roomGroup,w,.05,d,0,-.027,0,'#34404b','room')
 for(const side of Object.keys(r.walls) as WallSide[]){if(!r.walls[side])continue;const horizontal=side==='north'||side==='south';const length=horizontal?r.width:r.depth;for(const panel of wallPanels(r,side,state.objects)){
 const along=(panel.start+panel.width/2-length/2)/1000,bottom=(panel.bottom+panel.height/2)/1000
 const x=horizontal?along:(side==='west'?-1:1)*(w+t)/2,z=horizontal?(side==='north'?-1:1)*(d+t)/2:along
 const mesh=piece(roomGroup,horizontal?panel.width/1000:t,panel.height/1000,horizontal?t:panel.width/1000,x,bottom,z,state.structuralColor,'room');roomWalls.push({mesh,side,panel})
 }}
}
function buildObject(o:Box){
 const group=new T.Group();group.userData.id=o.id
 if(o.type==='group'){for(const child of groupChildren({...o,x:0,y:0,z:0,rotationX:0,rotationY:0,rotationZ:0})){const mesh=buildObject(child);mesh.position.set(child.x/1000,(child.y+worldDimensions(child).height/2-o.height/2)/1000,child.z/1000);mesh.rotation.set(T.MathUtils.degToRad(child.rotationX??0),T.MathUtils.degToRad(child.rotationY??0),T.MathUtils.degToRad(child.rotationZ??0),'XYZ');mesh.traverse(node=>{node.userData.id=o.id});group.add(mesh)}return group}
 if(!isOpening(o)){piece(group,o.width/1000,o.height/1000,o.depth/1000,0,0,0,o.color,o.id);return group}
 const w=o.width/1000,h=o.height/1000,d=o.depth/1000,f=Math.min(.06,w/8,h/8)
 piece(group,f,h,d,-(w-f)/2,h/2,0,o.color,o.id);piece(group,f,h,d,(w-f)/2,h/2,0,o.color,o.id);piece(group,w-2*f,f,d,0,h-f/2,0,o.color,o.id)
 if(o.type==='window'){
 piece(group,w-2*f,f,d,0,f/2,0,o.color,o.id);piece(group,f,h-2*f,d*.65,0,h/2,0,o.color,o.id)
 piece(group,w-2*f,h-2*f,Math.min(.012,d),0,h/2,0,'#a4d7eb',o.id,true)
 }else{
 const leaf=piece(group,w-2*f,h-f,Math.min(.04,d),0,(h-f)/2,0,o.color,o.id)
 // A visible handle distinguishes the door from a plain prism.
 piece(group,.075,.025,.06,w/2-f*2,h*.48,.045,'#d2d9de',o.id);piece(group,.075,.025,.06,w/2-f*2,h*.48,-.045,'#d2d9de',o.id);leaf.material.roughness=.65
 }
 return group
}
function sync(){if(!transform)return;syncing=true;syncRoom()
 for(const [id,mesh] of meshes)if(!state.objects.some(o=>o.id===id)){if(transform.object===mesh)transform.detach();scene.remove(mesh);dispose(mesh);meshes.delete(id);signatures.delete(id)}
 for(const o of state.objects){const signature=JSON.stringify([o.type,o.width,o.height,o.depth,o.color,o.children]);let mesh=meshes.get(o.id)
 if(!mesh||signatures.get(o.id)!==signature){if(mesh){for(const child of [...mesh.children]){mesh.remove(child);dispose(child)}const rebuilt=buildObject(o);for(const child of [...rebuilt.children])mesh.add(child)}else{mesh=buildObject(o);meshes.set(o.id,mesh);scene.add(mesh)}signatures.set(o.id,signature)}
 const opening=isOpening(o),dimensions=worldDimensions(o);mesh.position.set(o.x/1000,(o.y+(opening?0:dimensions.height/2))/1000,o.z/1000);if(opening)mesh.rotation.set(0,(o.wall==='east'||o.wall==='west')?Math.PI/2:0,0);else mesh.rotation.set(T.MathUtils.degToRad(o.rotationX??0),T.MathUtils.degToRad(o.rotationY??0),T.MathUtils.degToRad(o.rotationZ??0),'XYZ')
 mesh.traverse(child=>{if(child instanceof T.Mesh)child.material.emissive.set(selection.value.some(item=>item.id===o.id)?'#183c31':'#000000')})
 }
 const active=meshes.get(state.selected),object=state.objects.find(o=>o.id===state.selected)
 if(active){if(transform.object!==active)transform.attach(active)}else transform.detach()
 const rotating=state.transformMode==='rotate'&&!!object&&!isOpening(object);transform.setMode(rotating?'rotate':'translate');transform.setRotationSnap(state.snap?Math.PI/12:null)
 transform.showX=!object||!isOpening(object)||object.wall==='north'||object.wall==='south';transform.showZ=!object||!isOpening(object)||object.wall==='east'||object.wall==='west';transform.showY=object?.type!=='door'
 transform.setTranslationSnap(null);transform.enabled=false;transform.getHelper().visible=false;syncing=false
}
function view(name:string){if(!camera)return;const size=state.room?Math.max(state.room.width,state.room.depth,state.room.height)/1000:4,distance=Math.max(5,size*2),center=state.room?state.room.height/2000:.6;orbit.target.set(0,center,0);const positions:Record<string,number[]>={Perspectiva:[distance*.7,distance*.65,distance*.9],Superior:[0,distance*1.3,.001],Frontal:[0,center,distance*1.3],Lateral:[distance*1.3,center,0]};camera.position.fromArray(positions[name]!);orbit.update()}
defineExpose({view})
onMounted(()=>{try{
 renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.setClearColor('#141a23');host.value!.appendChild(renderer.domElement)
 camera=new T.PerspectiveCamera(42,1,.01,500);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.addEventListener('start',()=>{cameraInteracting=true;cameraMoving.value=true;controls.rotationInteraction.hovered=null});orbit.addEventListener('end',()=>{cameraInteracting=false});view('Perspectiva');previousCameraPosition.copy(camera.position);previousCameraRotation.copy(camera.quaternion);scene.add(new T.HemisphereLight(0xffffff,0x263346,2.8))
 const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,8,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-10,right:10,top:10,bottom:-10});scene.add(light)
 const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#141a23',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.receiveShadow=true;scene.add(floor);scene.add(new T.GridHelper(20,40,'#425064','#263344'))
 transform=new TransformControls(camera,renderer.domElement);transform.setSize(.85);scene.add(transform.getHelper());transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value});transform.addEventListener('mouseDown',()=>{if(transform.getMode()==='rotate')beginRotation();else checkpoint()});transform.addEventListener('mouseUp',()=>endRotation());transform.addEventListener('objectChange',()=>{if(syncing||!transform.object)return;const object=state.objects.find(o=>o.id===state.selected);if(!object)return;if(transform.getMode()==='rotate'){const r=transform.object.rotation;rotateSelected({rotationX:T.MathUtils.radToDeg(r.x),rotationY:T.MathUtils.radToDeg(r.y),rotationZ:T.MathUtils.radToDeg(r.z)});sync();return}const p=transform.object.position;const dimensions=worldDimensions(object);const baseY=isOpening(object)?p.y:p.y-dimensions.height/2000;const axis=transform.axis??'XYZ';const axes=(['x','y','z'] as Axis[]).filter(a=>axis.includes(a.toUpperCase()));moveSelected(p.x*1000,baseY*1000,p.z*1000,axes);sync()})
 let down={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4||transform.axis)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const candidates=[...meshes.values()].filter(o=>o.visible).concat(roomGroup.children.filter(o=>o.visible) as T.Group[]);selectObject(ray.intersectObjects(candidates,true)[0]?.object.userData.id??'',e.ctrlKey||e.metaKey||e.shiftKey)})
 observer=new ResizeObserver(()=>{const {clientWidth:w,clientHeight:h}=host.value!;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)});observer.observe(host.value!);sync()
 renderer.setAnimationLoop(()=>{
 const now=performance.now(),frameMs=previousFrameTime?Math.max(1,Math.min(100,now-previousFrameTime)):1000/60;previousFrameTime=now
 // A short, time-based damping tail behaves consistently at different frame rates.
 orbit.dampingFactor=1-Math.exp(-frameMs/80);orbit.update();
 const distance=Math.max(.01,camera.position.distanceTo(orbit.target)),pixelScale=host.value!.clientHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov)/2))
 const translation=previousCameraPosition.distanceTo(camera.position)/distance,rotation=2*Math.acos(Math.min(1,Math.abs(previousCameraRotation.dot(camera.quaternion))))
 cameraMoving.value=trackCameraMotion(cameraInteracting,Math.max(translation,rotation)*pixelScale*(1000/60)/frameMs)
 previousCameraPosition.copy(camera.position);previousCameraRotation.copy(camera.quaternion)
 if(state.room){const visible=visibleWallSides(state.room,{x:camera.position.x*1000,z:camera.position.z*1000});for(const wall of roomWalls)wall.mesh.visible=wallPanelVisible(state.room,wall.side,wall.panel,visible);}for(const o of state.objects){const mesh=meshes.get(o.id);if(mesh)mesh.visible=!isOpening(o)||!!state.room?.walls[o.wall!]&&(normals[o.wall!].dot(camera.position.clone().sub(mesh.position))<=0||selection.value.some(item=>item.id===o.id))}
 if(!cameraMoving.value)additionalOutlines.value=selection.value.filter(o=>o.id!==state.selected&&meshes.get(o.id)?.visible).map(o=>({id:o.id,path:projectSelectionOutline(o,meshes.get(o.id)!,camera,host.value!.clientWidth,host.value!.clientHeight)}))
 controls.update(camera,meshes.get(state.selected),host.value!.clientWidth,host.value!.clientHeight,host.value!.getBoundingClientRect());renderer.render(scene,camera)})
 }catch(e){console.error(e);error.value='No se pudo iniciar el visor 3D. Comprueba que WebGL esté habilitado en tu navegador.'}})
watch(()=>[state.objects,state.room,state.structuralColor,state.selected,state.selection,state.snap,state.wallSnap,state.step,state.transformMode],sync,{deep:true})
onBeforeUnmount(()=>{observer?.disconnect();renderer?.setAnimationLoop(null);orbit?.dispose();transform?.dispose();dispose(scene);renderer?.dispose()})
</script>
<template><div ref="host" class="viewport"><p v-if="error" class="viewport-error">{{error}}</p><div v-if="additionalOutlines.length" v-show="!cameraMoving" class="object-controls" aria-hidden="true"><svg class="object-dimensions" width="100%" height="100%"><path v-for="outline in additionalOutlines" :key="outline.id" :d="outline.path" :data-object-id="outline.id" class="selection-outline"/></svg></div><div v-if="overlay?.visible" v-show="!cameraMoving" class="object-controls" @pointermove="controls.move" @pointerup="controls.finish" @pointercancel="controls.finish" @lostpointercapture="controls.finish">
<svg class="object-dimensions" width="100%" height="100%" aria-hidden="true"><defs><marker id="dimension-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="#aabed0"/></marker></defs><path :d="overlay.outline" :data-object-id="state.selected" class="selection-outline"/><line v-for="measure in overlay.measures" :key="measure.key" :x1="measure.start.x" :y1="measure.start.y" :x2="measure.end.x" :y2="measure.end.y" class="dimension-line" marker-start="url(#dimension-arrow)" marker-end="url(#dimension-arrow)"/><line v-for="measure in overlay.measures" :key="measure.key+'leader'" :x1="(measure.start.x+measure.end.x)/2" :y1="(measure.start.y+measure.end.y)/2" :x2="measure.point.x" :y2="measure.point.y" class="dimension-leader"/></svg>
<button v-for="handle in overlay.handles" :key="handle.key+handle.sign" class="face-handle" :style="{left:handle.point.x+'px',top:handle.point.y+'px'}" :aria-label="'Redimensionar '+({width:'anchura',height:'altura',depth:'profundidad'}[handle.key])+(handle.sign>0?' positiva':' negativa')" :title="'Arrastra para cambiar '+({width:'anchura',height:'altura',depth:'profundidad'}[handle.key])" @pointerdown="e=>controls.start(e,'resize',handle)"/>
<button class="move-handle" :style="{left:overlay.base.x+'px',top:overlay.base.y+'px'}" aria-label="Mover sobre el suelo" title="Arrastra para mover sobre el suelo" @pointerdown="e=>controls.start(e,'move')">✥</button>
<button v-if="selected?.type!=='door'" class="lift-handle" :style="{left:overlay.lift.x+'px',top:overlay.lift.y+'px'}" aria-label="Elevar objeto" title="Arrastra para elevar" @pointerdown="e=>controls.start(e,'lift')">▲</button>
<template v-if="!overlay.opening"><svg class="rotation-rings" width="100%" height="100%" aria-hidden="true"><path v-for="control in overlay.rotations" :key="control.axis" :d="control.path" :stroke="control.color" v-show="(controls.rotationInteraction.dragging ?? controls.rotationInteraction.hovered)===control.axis"/></svg><button v-for="control in overlay.rotations" :key="control.axis" class="axis-rotation" @pointerenter="controls.rotationInteraction.hovered=control.axis" @pointerleave="controls.rotationInteraction.hovered=null" @focus="controls.rotationInteraction.hovered=control.axis" @blur="controls.rotationInteraction.hovered=null" :style="{left:control.point.x+'px',top:control.point.y+'px','--axis-color':control.color}" :aria-label="'Girar en '+control.axis" :title="'Arrastra siguiendo el aro para girar en '+control.axis" @pointerdown="e=>controls.start(e,'rotate',undefined,('rotation'+control.axis) as 'rotationX'|'rotationY'|'rotationZ',control.tangent)"><svg viewBox="0 0 40 40" aria-hidden="true"><defs><marker :id="'rotation-arrow-'+control.axis" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="currentColor"/></marker></defs><path :d="control.iconPath" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" :marker-start="'url(#rotation-arrow-'+control.axis+')'" :marker-end="'url(#rotation-arrow-'+control.axis+')'"/></svg></button></template>
<label v-for="measure in overlay.measures" :key="measure.key" :class="['measure-label','measure-'+measure.key]" :style="{left:measure.point.x+'px',top:measure.point.y+'px'}"><span>{{measure.label}}</span><div><input type="number" min="1" :aria-label="measure.label+' en escena'" :value="controls.drafts[measure.key] ?? Math.round(measure.value*1000)/1000" @focus="checkpoint" @input="e=>controls.drafts[measure.key]=(e.target as HTMLInputElement).value" @blur="e=>controls.changeMeasure(e,measure.key)" @keydown.enter="e=>(e.target as HTMLInputElement).blur()"><small>mm</small></div></label>
</div></div></template>




