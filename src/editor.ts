import { reactive, computed, watch } from 'vue'
import { resizedFromFace, type DimensionKey } from './faceResize.ts'
import { fitRotation } from './rotationFit.ts'
import { hasObjectCollisions, intersectsObjects, objectBounds, collisionPeers } from './objectCollisions.ts'
import { worldDimensions, normalizeAngle } from './geometry.ts'
import { intersectsRoom, limitMovement, fitRoomObject } from './collisions.ts'
import { snapPosition, touchingWalls, type Axis } from './snapping.ts'
export type ObjectKind = 'box' | 'door' | 'window' | 'column' | 'beam'
export type WallSide = 'north' | 'south' | 'east' | 'west'
export interface Box { id:string; name:string; type?:ObjectKind; wall?:WallSide; offset?:number; x:number; y:number; z:number; width:number; height:number; depth:number; color:string; rotationX?:number; rotationY?:number; rotationZ?:number; collisions?:boolean }
export interface Room { width:number; depth:number; height:number; thickness:number; walls:Record<WallSide,boolean> }
export const labels:Record<ObjectKind,string>={box:'Prisma',door:'Puerta',window:'Ventana',column:'Columna',beam:'Viga'}
export const defaultRoom=():Room=>({width:4000,depth:3500,height:2500,thickness:120,walls:{north:true,south:true,east:true,west:true}})
export const state=reactive({objects:[] as Box[],room:defaultRoom() as Room|null,selected:'room',collisions:true,snap:true,wallSnap:true,step:50,error:'',autosaveError:'',collisionBlocked:false,transformMode:'translate' as 'translate'|'rotate'})
export const collisionSelection=computed(()=>{
 const active=state.objects.filter(object=>object.collisions??state.collisions).length
 return {checked:state.objects.length?active===state.objects.length:state.collisions,mixed:active>0&&active<state.objects.length}
})
function collisionObjects(objects:Box[]=state.objects){return objects.map(object=>({...object,collisions:object.collisions??state.collisions}))}
function collidable(object:Box){return {...object,collisions:object.collisions??state.collisions}}
export const selected=computed(()=>state.objects.find(o=>o.id===state.selected))
export const wallContacts=computed(()=>selected.value?touchingWalls(selected.value,state.room,state.objects):[])
export function snapSelected(axes:Axis[]=['x','y','z']){const o=selected.value;if(!o||isOpening(o))return;const {position}=snapPosition(o,state.room,state.objects,o,{enabled:state.snap,walls:state.wallSnap,step:state.step,axes,grid:false});applyMovement(o,position)}
export function isOpening(o:Box){return o.type==='door'||o.type==='window'}
export function wallLength(room:Room,side:WallSide){return side==='north'||side==='south'?room.width:room.depth}
export function normalizeOpening(o:Box,room:Room){if(!isOpening(o))return;const side=o.wall??'north';o.wall=side;const length=wallLength(room,side);o.width=Math.min(o.width,length);o.height=Math.min(o.height,room.height);o.y=o.type==='door'?0:Math.min(Math.max(0,o.y),room.height-o.height);o.offset=Math.min(Math.max(o.width/2,o.offset??length/2),length-o.width/2);const along=o.offset-length/2;if(side==='north'||side==='south'){o.x=along;o.z=(side==='north'?-1:1)*(room.depth+room.thickness)/2}else{o.z=along;o.x=(side==='west'?-1:1)*(room.width+room.thickness)/2}}
function prepareRoom(room:Room,objects:Box[]){for(const o of objects){normalizeOpening(o,room);if(!fitRoomObject(o,room))return false}return !hasObjectCollisions(collisionObjects(objects),room,true)}
function applyMovement(o:Box,position:Pick<Box,'x'|'y'|'z'>){const result=limitMovement(collidable(o),state.room,position,collisionObjects(),true);Object.assign(o,result.position);state.collisionBlocked=result.blocked}
const past:string[]=[],future:string[]=[]
export const history=reactive({undo:0,redo:0})
function snapshot(){return JSON.stringify({objects:state.objects,room:state.room,selected:state.selected,collisions:state.collisions})}
function restore(value:string){const data=JSON.parse(value);state.objects=data.objects;state.room=data.room;state.selected=data.selected;state.collisions=data.collisions??false}
function counts(){history.undo=past.length;history.redo=future.length}
export function checkpoint(){past.push(snapshot());if(past.length>100)past.shift();future.length=0;counts()}
export function undo(){if(!past.length)return;future.push(snapshot());restore(past.pop()!);counts()}
export function redo(){if(!future.length)return;past.push(snapshot());restore(future.pop()!);counts()}
export function createRoom(){const room=defaultRoom(),objects=state.objects.map(o=>({...o}));if(!prepareRoom(room,objects)){state.error='Los objetos no caben en la habitación. Reduce sus dimensiones antes de crearla.';return}checkpoint();state.room=room;state.objects=objects;state.selected='room'}
export function editRoom(key:'width'|'depth'|'height'|'thickness',value:string){
 const n=Number(value);if(!state.room||!Number.isFinite(n)||n<1||n>100000)return
 const room={...state.room,walls:{...state.room.walls},[key]:n},objects=state.objects.map(o=>({...o}))
 if(!prepareRoom(room,objects)){state.error='La habitación no puede tener esas medidas: hay un objeto que no cabe entre las paredes, bajo el techo o sin solaparse con otro elemento.';return}
 state.room=room;state.objects=objects;state.error='';state.collisionBlocked=false
}
export function toggleWall(key:WallSide){if(!state.room)return;const room={...state.room,walls:{...state.room.walls,[key]:!state.room.walls[key]}},objects=state.objects.map(o=>({...o}));if(!prepareRoom(room,objects)){state.error='No se puede activar la pared: hay un objeto demasiado grande o solapado. Reduce sus medidas o cambia su posición.';return}checkpoint();state.room=room;state.objects=objects;state.error=''}
export function add(type:ObjectKind='box'){
 if((type==='door'||type==='window')&&!state.room)return
 const wall=state.room?(Object.keys(state.room.walls) as WallSide[]).find(k=>state.room!.walls[k]):undefined
 if((type==='door'||type==='window')&&!wall){state.error='Activa una pared de la habitación para añadir puertas o ventanas.';return}
 const n=state.objects.filter(o=>(o.type??'box')===type).length+1
 const o:Box={id:crypto.randomUUID(),name:`${labels[type]} ${n}`,type,collisions:state.collisions,x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e'}
 if(type==='column'){o.width=300;o.depth=300;o.height=state.room?.height??2500;o.x=-1000;o.color='#a0aaba'}
 if(type==='beam'){o.width=state.room?.width??3000;o.height=250;o.depth=300;o.y=Math.max(0,(state.room?.height??2500)-250);o.color='#96a4b5'}
 if(type==='door'||type==='window'){o.wall=wall!;o.offset=wallLength(state.room!,wall!)/2;o.width=type==='door'?900:1200;o.height=type==='door'?2100:1000;o.depth=state.room!.thickness;o.y=type==='door'?0:1000;o.color=type==='door'?'#b78b61':'#7faec6';normalizeOpening(o,state.room!)}
 if(state.room&&!isOpening(o)){o.width=Math.min(o.width,state.room.width);o.depth=Math.min(o.depth,state.room.depth);o.height=Math.min(o.height,state.room.height);if(o.type==='beam')o.y=Math.max(0,state.room.height-o.height);fitRoomObject(o,state.room)}
 const placed=findPlacement(o);if(!placed){state.error='No se encontró espacio libre para añadir este elemento. Desactiva las colisiones generales o libera espacio.';return}
 checkpoint();state.objects.push(placed);state.selected=placed.id;state.error='';state.collisionBlocked=false
}
function findPlacement(object:Box):Box|null{
 const candidates:Box[]=[object],dimensions=worldDimensions(object)
 for(const other of collisionPeers(collidable(object),collisionObjects(),state.room,true)){
  const bounds=objectBounds(other)
  if(isOpening(object)&&state.room){
   const axis=object.wall==='north'||object.wall==='south'?'x':'z'
   for(const along of [bounds.min[axis]-object.width/2,bounds.max[axis]+object.width/2])candidates.push({...object,offset:along+wallLength(state.room,object.wall!)/2})
   if(object.type==='window')for(const y of [bounds.min.y-object.height,bounds.max.y])candidates.push({...object,y})
  }else{
   for(const axis of ['x','y','z'] as const){
    const size=axis==='x'?dimensions.width:axis==='z'?dimensions.depth:dimensions.height
    for(const value of [bounds.min[axis]-(axis==='y'?size:size/2),bounds.max[axis]+(axis==='y'?0:size/2)]){
     candidates.push({...object,[axis]:value})
     candidates.push({...object,x:other.x,z:other.z,[axis]:value})
    }
   }
  }
 }
 candidates.sort((a,b)=>Math.hypot(a.x-object.x,a.y-object.y,a.z-object.z,(a.offset??0)-(object.offset??0))-Math.hypot(b.x-object.x,b.y-object.y,b.z-object.z,(b.offset??0)-(object.offset??0)))
 for(const candidate of candidates){
  if(candidate.y<0)continue
  if(state.room){if(isOpening(candidate))normalizeOpening(candidate,state.room);else if(!fitRoomObject(candidate,state.room))continue}
  if(!intersectsRoom(candidate,state.room)&&!intersectsObjects(collidable(candidate),collisionObjects(),state.room,true))return candidate
 }
 return null
}
export function duplicate(){
 if(!selected.value)return
 const source=selected.value,box={...source,id:crypto.randomUUID(),name:source.name+' copia'}
 if(isOpening(box)&&state.room){box.offset=(box.offset??0)+box.width+100;normalizeOpening(box,state.room)}
 else Object.assign(box,limitMovement(source,state.room,{x:source.x+200,y:source.y,z:source.z+200}).position)
 const placed=findPlacement(box)
 if(!placed){state.error='No se encontró espacio libre para duplicar este elemento.';return}
 checkpoint();state.objects.push(placed);state.selected=placed.id;state.error='';state.collisionBlocked=false
}
export function toggleCollisions(enabled=!(collisionSelection.value.checked||collisionSelection.value.mixed)){
 const objects=state.objects.map(object=>({...object,collisions:enabled}))
 if(hasObjectCollisions(objects,state.room,true)){state.error='Hay elementos solapados. Sepáralos antes de activar las colisiones de todos.';return}
 checkpoint();state.collisions=enabled;state.objects=objects;state.error='';state.collisionBlocked=false
}
export function toggleSelectedCollisions(){
 const object=selected.value;if(!object)return
 const candidate={...object,collisions:!(object.collisions??state.collisions)}
 if(intersectsObjects(collidable(candidate),collisionObjects(),state.room,true)){state.error='Este elemento se solapa con otro. Sepáralos antes de activar sus colisiones.';return}
 checkpoint();object.collisions=candidate.collisions;state.error='';state.collisionBlocked=false
}
function objectCollision(candidate:Box){
 if(!intersectsObjects(collidable(candidate),collisionObjects(),state.room,true))return false
 state.error='El elemento se solaparía con otro. Muévelo o desactiva sus colisiones.';state.collisionBlocked=true;return true
}
function moveOpening(object:Box,candidate:Box){
 if(!state.room)return
 const {position,blocked}=limitMovement(collidable(object),state.room,candidate,collisionObjects(),true)
 const length=wallLength(state.room,object.wall!)
 object.offset=(object.wall==='north'||object.wall==='south'?position.x:position.z)+length/2
 object.y=position.y;normalizeOpening(object,state.room);state.collisionBlocked=blocked;state.error=''
}
export function remove(){if(!selected.value)return;checkpoint();state.objects=state.objects.filter(o=>o.id!==state.selected);state.selected=state.room?'room':''}
export function edit(key:keyof Box,value:string,record=true){
 const o=selected.value;if(!o)return
 if(key==='collisions'){toggleSelectedCollisions();return}
 if(key==='wall'){if(!state.room||!['north','south','east','west'].includes(value))return;if(record)checkpoint();const candidate={...o,wall:value as WallSide};normalizeOpening(candidate,state.room);if(intersectsRoom(candidate,state.room)){state.error='El marco atraviesa otra pared. Reduce su profundidad antes de cambiar de pared.';return}if(objectCollision(candidate))return;Object.assign(o,candidate);state.error='';return}
 if(key==='name'||key==='color'){if(record)checkpoint();Object.assign(o,{[key]:value});return}
 const n=Number(value);if(!value.trim()||!Number.isFinite(n)||Math.abs(n)>100000||(['width','height','depth'].includes(key)&&n<1))return
 if(key==='rotationX'||key==='rotationY'||key==='rotationZ'){rotateSelected({...o,[key]:n},record);return}
 const candidate={...o,[key]:key==='y'?Math.max(0,n):n}
 if(isOpening(candidate)&&state.room)normalizeOpening(candidate,state.room)
 else if(key==='x'||key==='y'||key==='z'){if(record)checkpoint();applyMovement(o,candidate);return}
 else if(intersectsRoom(candidate,state.room)){state.error='Estas dimensiones harían que el objeto atravesase una pared o el techo. Reduce su tamaño o muévelo.';return}
 if(isOpening(o)&&(key==='offset'||key==='y')){if(record)checkpoint();moveOpening(o,candidate);return}
 if(objectCollision(candidate))return
 if(intersectsRoom(candidate,state.room)){state.error='El marco atraviesa otra pared. Reduce su profundidad.';return}if(record)checkpoint();Object.assign(o,candidate);state.error='';state.collisionBlocked=false
}
let rotationReference:Box|null=null
export function beginRotation(){checkpoint();rotationReference=selected.value?{...selected.value}:null}
export function endRotation(){rotationReference=null}
export function rotateSelected(rotation:Pick<Box,'rotationX'|'rotationY'|'rotationZ'>,record=false){
 const o=selected.value;if(!o||isOpening(o))return
 const reference=rotationReference?.id===o.id?rotationReference:o
 const candidate={...o,width:reference.width,height:reference.height,depth:reference.depth,rotationX:normalizeAngle(rotation.rotationX??0),rotationY:normalizeAngle(rotation.rotationY??0),rotationZ:normalizeAngle(rotation.rotationZ??0)}
 const fitted=fitRotation(candidate,state.room);if(objectCollision(fitted))return
 if(record)checkpoint();Object.assign(o,fitted);state.error='';state.collisionBlocked=false
}
export function resizeSelectedFromFace(original:Box,key:DimensionKey,size:number,sign:number,direction:{x:number;y:number;z:number}){
 const o=selected.value;if(!o||o.id!==original.id)return
 if(state.snap)size=Math.round(size/state.step)*state.step
 const make=(value:number)=>{const candidate=resizedFromFace(original,key,value,sign,direction);if(state.room&&isOpening(candidate))normalizeOpening(candidate,state.room);return candidate}
 const valid=(candidate:Box)=>candidate.y>=-1e-7&&!intersectsRoom(candidate,state.room)&&!intersectsObjects(collidable(candidate),collisionObjects(),state.room,true)
 let candidate=make(size)
 if(!valid(candidate)){let low=0,high=1;for(let i=0;i<40;i++){const mid=(low+high)/2;if(valid(make(original[key]+(size-original[key])*mid)))low=mid;else high=mid}candidate=make(original[key]+(size-original[key])*low);state.collisionBlocked=true}else state.collisionBlocked=false
 candidate.y=Math.max(0,candidate.y);Object.assign(o,candidate);state.error=''
}
export function moveSelected(x:number,y:number,z:number,axes:Axis[]=['x','y','z']){
 const o=selected.value;if(!o)return
 const {position}=snapPosition(o,state.room,state.objects,{x,y,z},{enabled:state.snap,walls:state.wallSnap,step:state.step,axes})
 if(isOpening(o)&&state.room){const length=wallLength(state.room,o.wall!);const candidate={...o,offset:(o.wall==='north'||o.wall==='south'?position.x:position.z)+length/2,y:position.y};normalizeOpening(candidate,state.room);moveOpening(o,candidate)}else applyMovement(o,position)
}
export function projectJSON(){return JSON.stringify({version:5,units:'mm',room:state.room,objects:collisionObjects(),collisions:state.collisions})}
export function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(projectJSON()),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gridly.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function parseProject(value:string):{room:Room|null;objects:Box[];collisions:boolean}{
 const data=JSON.parse(value);if(![1,2,3,4,5].includes(data.version)||data.units!=='mm'||!Array.isArray(data.objects)||data.objects.length>1000)throw Error()
 if(data.collisions!==undefined&&typeof data.collisions!=='boolean')throw Error()
 const collisions=data.collisions??false
 const ids=new Set(['room']);for(const o of data.objects){if(o.collisions!==undefined&&typeof o.collisions!=='boolean')throw Error();if(typeof o.id!=='string'||ids.has(o.id)||typeof o.name!=='string'||!/^#[0-9a-f]{6}$/i.test(o.color))throw Error();ids.add(o.id);for(const key of ['x','y','z','width','height','depth'])if(typeof o[key]!=='number'||!Number.isFinite(o[key])||Math.abs(o[key])>1e7)throw Error();if(o.y<0||Math.min(o.width,o.height,o.depth)<0.001)throw Error();for(const key of ['rotationX','rotationY','rotationZ'])if(o[key]!==undefined&&(typeof o[key]!=='number'||!Number.isFinite(o[key])||Math.abs(o[key])>36000))throw Error();if(isOpening(o)&&[o.rotationX,o.rotationY,o.rotationZ].some(angle=>angle!==undefined&&angle!==0))throw Error();if(o.type!==undefined&&!Object.keys(labels).includes(o.type))throw Error();if(isOpening(o)&&(!['north','south','east','west'].includes(o.wall)||typeof o.offset!=='number'||!Number.isFinite(o.offset)))throw Error()}
 const room=data.version===1?null:data.room;if(room!==null){for(const key of ['width','depth','height','thickness'])if(typeof room?.[key]!=='number'||!Number.isFinite(room[key])||room[key]<1||room[key]>100000)throw Error();for(const key of ['north','south','east','west'])if(typeof room.walls?.[key]!=='boolean')throw Error()}
 if(!room&&data.objects.some(isOpening))throw Error();if(room){data.objects.forEach((o:Box)=>normalizeOpening(o,room));if(data.objects.some((o:Box)=>intersectsRoom(o,room)))throw Error('collision')}
 // Versions 1–4 used the general switch as a gate; preserve their effective settings.
 for(const object of data.objects)object.collisions=data.version<5?collisions&&object.collisions!==false:object.collisions??collisions
 if(hasObjectCollisions(data.objects,room,true))throw Error('objects')
 return {room,objects:data.objects,collisions}
}
export async function load(file:File){try{
 const {room,objects,collisions}=parseProject(await file.text());checkpoint();state.objects=objects;state.room=room;state.collisions=collisions;state.selected=room?'room':'';state.error=''
 }catch(error){state.error=error instanceof Error&&error.message==='objects'?'El proyecto contiene elementos solapados con las colisiones activadas. Desactívalas o corrige sus posiciones en el JSON.':error instanceof Error&&error.message==='collision'?'El proyecto contiene objetos que atraviesan paredes o el techo. Corrige sus posiciones antes de abrirlo.':'No se pudo abrir el archivo. Usa un proyecto JSON de Gridly válido.'}}


export const AUTOSAVE_KEY='gridly.autosave'
type ProjectStorage=Pick<Storage,'getItem'|'setItem'>
// Vue agrupa los cambios de una operación para guardar una escena completa,
// también durante arrastres. pagehide fuerza el último cambio antes de salir.
export function startAutosave(getStorage:()=>ProjectStorage){
 try{
  const saved=getStorage().getItem(AUTOSAVE_KEY)
  if(saved!==null){
   const {room,objects,collisions}=parseProject(saved)
   state.room=room;state.objects=objects;state.collisions=collisions;state.selected=room?'room':''
  }
  state.autosaveError=''
 }catch{
  state.autosaveError='No se pudo recuperar el autoguardado local. Puedes abrir un proyecto JSON guardado.'
 }
 let savedJSON=projectJSON()
 function flush(){
  const value=projectJSON()
  if(value===savedJSON)return
  try{getStorage().setItem(AUTOSAVE_KEY,value);savedJSON=value;state.autosaveError=''}
  catch{state.autosaveError='No se pudo autoguardar en este navegador. Usa Guardar proyecto para conservar los cambios.'}
 }
 const stop=watch(projectJSON,flush)
 return {flush,stop}
}
if(typeof window!=='undefined'){
 const autosave=startAutosave(()=>window.localStorage)
 window.addEventListener('pagehide',autosave.flush)
}
