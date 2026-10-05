<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { state, selected, checkpoint, isOpening, moveSelected, rotateSelected, beginRotation, endRotation, type Box, type WallSide } from './editor'
import { worldDimensions } from './geometry'
import { wallPanels } from './walls'
import { useObjectControls } from './useObjectControls'
import type { Axis } from './snapping'
const host=ref<HTMLDivElement>();const error=ref('')
const controls=useObjectControls(active=>{if(orbit)orbit.enabled=!active});const overlay=controls.overlay
let renderer:T.WebGLRenderer,orbit:OrbitControls,transform:TransformControls,observer:ResizeObserver,camera:T.PerspectiveCamera
const scene=new T.Scene(),roomGroup=new T.Group();scene.add(roomGroup)
const roomWalls:{mesh:T.Mesh;normal:T.Vector3}[]=[]
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
 const mesh=piece(roomGroup,horizontal?panel.width/1000:t,panel.height/1000,horizontal?t:panel.width/1000,x,bottom,z,state.structuralColor,'room');roomWalls.push({mesh,normal:normals[side]})
 }}
}
function buildObject(o:Box){
 const group=new T.Group();group.userData.id=o.id
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
 for(const o of state.objects){const signature=JSON.stringify([o.type,o.width,o.height,o.depth,o.color]);let mesh=meshes.get(o.id)
 if(!mesh||signatures.get(o.id)!==signature){if(mesh){for(const child of [...mesh.children]){mesh.remove(child);dispose(child)}const rebuilt=buildObject(o);for(const child of [...rebuilt.children])mesh.add(child)}else{mesh=buildObject(o);meshes.set(o.id,mesh);scene.add(mesh)}signatures.set(o.id,signature)}
 const opening=isOpening(o),dimensions=worldDimensions(o);mesh.position.set(o.x/1000,(o.y+(opening?0:dimensions.height/2))/1000,o.z/1000);if(opening)mesh.rotation.set(0,(o.wall==='east'||o.wall==='west')?Math.PI/2:0,0);else mesh.rotation.set(T.MathUtils.degToRad(o.rotationX??0),T.MathUtils.degToRad(o.rotationY??0),T.MathUtils.degToRad(o.rotationZ??0),'XYZ')
 mesh.traverse(child=>{if(child instanceof T.Mesh)child.material.emissive.set(o.id===state.selected?'#183c31':'#000000')})
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
 camera=new T.PerspectiveCamera(42,1,.01,500);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;view('Perspectiva');scene.add(new T.HemisphereLight(0xffffff,0x263346,2.8))
 const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,8,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-10,right:10,top:10,bottom:-10});scene.add(light)
 const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#141a23',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.receiveShadow=true;scene.add(floor);scene.add(new T.GridHelper(20,40,'#425064','#263344'));scene.add(new T.AxesHelper(1))
 transform=new TransformControls(camera,renderer.domElement);transform.setSize(.85);scene.add(transform.getHelper());transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value});transform.addEventListener('mouseDown',()=>{if(transform.getMode()==='rotate')beginRotation();else checkpoint()});transform.addEventListener('mouseUp',()=>endRotation());transform.addEventListener('objectChange',()=>{if(syncing||!transform.object)return;const object=state.objects.find(o=>o.id===state.selected);if(!object)return;if(transform.getMode()==='rotate'){const r=transform.object.rotation;rotateSelected({rotationX:T.MathUtils.radToDeg(r.x),rotationY:T.MathUtils.radToDeg(r.y),rotationZ:T.MathUtils.radToDeg(r.z)});sync();return}const p=transform.object.position;const dimensions=worldDimensions(object);const baseY=isOpening(object)?p.y:p.y-dimensions.height/2000;const axis=transform.axis??'XYZ';const axes=(['x','y','z'] as Axis[]).filter(a=>axis.includes(a.toUpperCase()));moveSelected(p.x*1000,baseY*1000,p.z*1000,axes);sync()})
 let down={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4||transform.axis)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const candidates=[...meshes.values()].filter(o=>o.visible).concat(roomGroup.children.filter(o=>o.visible) as T.Group[]);state.selected=ray.intersectObjects(candidates,true)[0]?.object.userData.id??''})
 observer=new ResizeObserver(()=>{const {clientWidth:w,clientHeight:h}=host.value!;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)});observer.observe(host.value!);sync()
 renderer.setAnimationLoop(()=>{orbit.update();for(const wall of roomWalls)wall.mesh.visible=wall.normal.dot(camera.position.clone().sub(wall.mesh.position))<=0;for(const o of state.objects){const mesh=meshes.get(o.id);if(mesh)mesh.visible=!isOpening(o)||!!state.room?.walls[o.wall!]&&(normals[o.wall!].dot(camera.position.clone().sub(mesh.position))<=0||o.id===state.selected)}controls.update(camera,meshes.get(state.selected),host.value!.clientWidth,host.value!.clientHeight,host.value!.getBoundingClientRect());renderer.render(scene,camera)})
 }catch(e){console.error(e);error.value='No se pudo iniciar el visor 3D. Comprueba que WebGL esté habilitado en tu navegador.'}})
watch(()=>[state.objects,state.room,state.structuralColor,state.selected,state.snap,state.wallSnap,state.step,state.transformMode],sync,{deep:true})
onBeforeUnmount(()=>{observer?.disconnect();renderer?.setAnimationLoop(null);orbit?.dispose();transform?.dispose();dispose(scene);renderer?.dispose()})
</script>
<template><div ref="host" class="viewport"><p v-if="error" class="viewport-error">{{error}}</p><div v-if="overlay?.visible" class="object-controls" @pointermove="controls.move" @pointerup="controls.finish" @pointercancel="controls.finish" @lostpointercapture="controls.finish">
<svg class="object-dimensions" width="100%" height="100%" aria-hidden="true"><defs><marker id="dimension-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="#aabed0"/></marker></defs><path :d="overlay.outline" class="selection-outline"/><line v-for="measure in overlay.measures" :key="measure.key" :x1="measure.start.x" :y1="measure.start.y" :x2="measure.end.x" :y2="measure.end.y" class="dimension-line" marker-start="url(#dimension-arrow)" marker-end="url(#dimension-arrow)"/><line v-for="measure in overlay.measures" :key="measure.key+'leader'" :x1="(measure.start.x+measure.end.x)/2" :y1="(measure.start.y+measure.end.y)/2" :x2="measure.point.x" :y2="measure.point.y" class="dimension-leader"/></svg>
<button v-for="handle in overlay.handles" :key="handle.key+handle.sign" class="face-handle" :style="{left:handle.point.x+'px',top:handle.point.y+'px'}" :aria-label="'Redimensionar '+({width:'anchura',height:'altura',depth:'profundidad'}[handle.key])+(handle.sign>0?' positiva':' negativa')" :title="'Arrastra para cambiar '+({width:'anchura',height:'altura',depth:'profundidad'}[handle.key])" @pointerdown="e=>controls.start(e,'resize',handle)"/>
<button class="move-handle" :style="{left:overlay.base.x+'px',top:overlay.base.y+'px'}" aria-label="Mover sobre el suelo" title="Arrastra para mover sobre el suelo" @pointerdown="e=>controls.start(e,'move')">✥</button>
<button v-if="selected?.type!=='door'" class="lift-handle" :style="{left:overlay.lift.x+'px',top:overlay.lift.y+'px'}" aria-label="Elevar objeto" title="Arrastra para elevar" @pointerdown="e=>controls.start(e,'lift')">▲</button>
<template v-if="!overlay.opening"><svg class="rotation-rings" width="100%" height="100%" aria-hidden="true"><path v-for="control in overlay.rotations" :key="control.axis" :d="control.path" :stroke="control.color" v-show="(controls.rotationInteraction.dragging ?? controls.rotationInteraction.hovered)===control.axis"/></svg><button v-for="control in overlay.rotations" :key="control.axis" class="axis-rotation" @pointerenter="controls.rotationInteraction.hovered=control.axis" @pointerleave="controls.rotationInteraction.hovered=null" @focus="controls.rotationInteraction.hovered=control.axis" @blur="controls.rotationInteraction.hovered=null" :style="{left:control.point.x+'px',top:control.point.y+'px','--axis-color':control.color}" :aria-label="'Girar en '+control.axis" :title="'Arrastra siguiendo el aro para girar en '+control.axis" @pointerdown="e=>controls.start(e,'rotate',undefined,('rotation'+control.axis) as 'rotationX'|'rotationY'|'rotationZ',control.tangent)">⤾ <small>{{control.axis}}</small></button></template>
<label v-for="measure in overlay.measures" :key="measure.key" :class="['measure-label','measure-'+measure.key]" :style="{left:measure.point.x+'px',top:measure.point.y+'px'}"><span>{{measure.label}}</span><div><input type="number" min="1" :aria-label="measure.label+' en escena'" :value="controls.drafts[measure.key] ?? Math.round(measure.value*1000)/1000" @focus="checkpoint" @input="e=>controls.drafts[measure.key]=(e.target as HTMLInputElement).value" @blur="e=>controls.changeMeasure(e,measure.key)" @keydown.enter="e=>(e.target as HTMLInputElement).blur()"><small>mm</small></div></label>
</div></div></template>




