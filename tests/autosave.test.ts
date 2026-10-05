import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { AUTOSAVE_KEY, startAutosave, state, defaultRoom, add, edit, editRoom, toggleWall, duplicate, remove, checkpoint, undo, redo, moveSelected, rotateSelected, resizeSelectedFromFace, selected, load, projectJSON } from '../src/editor.ts'

const values=new Map<string,string>()
let writes=0
const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{writes++;values.set(key,value)}}
const saved=()=>JSON.parse(values.get(AUTOSAVE_KEY)!)
const autosave=startAutosave(()=>storage)
await nextTick();assert.equal(writes,0)
add();await nextTick();assert.equal(saved().objects.length,1)
edit('name','Mesa');edit('color','#123456');await nextTick()
assert.equal(saved().objects[0].name,'Mesa');assert.equal(saved().objects[0].color,'#123456')
checkpoint();editRoom('width','5000');toggleWall('north');await nextTick()
assert.equal(saved().room.width,5000);assert.equal(saved().room.walls.north,false)
moveSelected(300,100,200);await nextTick();assert.equal(saved().objects[0].x,300)
rotateSelected({rotationY:30});await nextTick();assert.equal(saved().objects[0].rotationY,30)
const original={...selected.value!}
resizeSelectedFromFace(original,'height',700,1,{x:0,y:1,z:0});await nextTick()
assert.equal(saved().objects[0].height,selected.value!.height)
duplicate();await nextTick();assert.equal(saved().objects.length,2)
remove();await nextTick();assert.equal(saved().objects.length,1)
undo();await nextTick();assert.equal(saved().objects.length,2)
redo();await nextTick();assert.equal(saved().objects.length,1)
const beforeSelection=writes
state.selected='room';state.snap=false;state.step=10;state.error='Aviso'
await nextTick();assert.equal(writes,beforeSelection)
const project={version:4,units:'mm',room:{...defaultRoom(),width:6400},objects:[]}
await load(new File([JSON.stringify(project)],'project.json'));await nextTick()
assert.equal(saved().room.width,6400);assert.equal(saved().version,4)
const beforeInvalid=writes
await load(new File(['{}'],'invalid.json'));await nextTick();assert.equal(writes,beforeInvalid)
// El cierre guarda incluso si aún no se ha ejecutado el watcher.
editRoom('depth','4200');autosave.flush();assert.equal(saved().room.depth,4200)
autosave.stop()
state.room=defaultRoom();state.objects=[]
const restored=startAutosave(()=>storage)
assert.equal(state.room!.width,6400);assert.equal(state.room!.depth,4200)
await nextTick();assert.equal(state.autosaveError,'')
restored.stop()

// La recuperación reutiliza las cuatro versiones y conserva proyectos inválidos.
for(const version of [1,2,3,4]){
 values.set(AUTOSAVE_KEY,JSON.stringify({...project,version}))
 const legacy=startAutosave(()=>storage)
 assert.equal(state.room?.width??null,version===1?null:6400)
 assert.equal(state.autosaveError,'');legacy.stop()
}
for(const corrupt of ['{',JSON.stringify({...project,room:{...project.room,width:-1}}),JSON.stringify({...project,objects:[{id:'outside',name:'Fuera',type:'box',color:'#123456',x:3200,y:0,z:0,width:600,height:600,depth:600}]})]){
 values.set(AUTOSAVE_KEY,corrupt)
 const before=projectJSON(),beforeWrites=writes
 const invalid=startAutosave(()=>storage)
 assert.equal(projectJSON(),before);assert.ok(state.autosaveError)
 await nextTick();assert.equal(writes,beforeWrites);assert.equal(values.get(AUTOSAVE_KEY),corrupt)
 invalid.stop()
}
// Almacenamiento bloqueado: la edición sigue funcionando y puede reintentarse.
let blocked=true
const unavailable=startAutosave(()=>{if(blocked)throw Error('denied');return storage})
assert.ok(state.autosaveError)
editRoom('height','2600');await nextTick();assert.equal(state.room!.height,2600)
assert.match(state.autosaveError,/No se pudo autoguardar/)
blocked=false;unavailable.flush();assert.equal(saved().room.height,2600);assert.equal(state.autosaveError,'')
unavailable.stop()
const quota=startAutosave(()=>({getItem:storage.getItem,setItem:()=>{throw Error('quota')}}))
editRoom('height','2700');await nextTick();assert.match(state.autosaveError,/No se pudo autoguardar/)
assert.equal(saved().room.height,2600);quota.stop()
console.log('Autosave mutations, restoration, versions 1–4, invalid data, close flush and storage failures passed.')
