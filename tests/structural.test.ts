import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { intersectsObjects, hasObjectCollisions } from '../src/objectCollisions.ts'
import { limitMovement } from '../src/collisions.ts'
import { state, selected, defaultRoom, WALL_COLOR, collisionSelection, toggleCollisions, toggleSelectedCollisions, moveSelected, snapSelected, checkpoint, undo, redo, edit, load, projectJSON, startAutosave, add, resizeSelectedFromFace, editStructuralColor, duplicate } from '../src/editor.ts'
import type { Box } from '../src/editor.ts'
const box:Box={id:'box',name:'Prisma',type:'box',collisions:false,x:-1000,y:0,z:0,width:400,height:400,depth:400,color:'#779b8e'}
const room=defaultRoom()
for(const type of ['beam','column'] as const){
 const structure:Box={...box,id:type,type,x:0,collisions:false}
 assert.equal(intersectsObjects({...box,x:0},[structure],room,false),true)
 assert.equal(intersectsObjects(structure,[{...box,x:0}],room,false),true)
 assert.equal(hasObjectCollisions([structure,{...box,x:0}],room,false),true)
 assert.equal(limitMovement(box,room,{x:10000,y:0,z:0},[structure],false).position.x,-400)
 state.room=defaultRoom();state.objects=[{...box},structure];state.selected=type;state.collisions=false;state.snap=false
 toggleSelectedCollisions();assert.equal(structure.collisions,false) // API cannot disable its effective collision.
 toggleCollisions(false);assert.equal(selected.value!.collisions,true);assert.equal(state.objects[0]!.collisions,false)
 assert.equal(collisionSelection.value.checked,false);assert.equal(collisionSelection.value.mixed,false)
 state.selected=box.id;moveSelected(10000,0,0);assert.equal(selected.value!.x,-400)
 edit('width','1000');assert.equal(selected.value!.width,400)
 resizeSelectedFromFace({...selected.value!},'width',800,1,{x:1,y:0,z:0});assert.ok(selected.value!.width<400.001)
 state.selected=type;checkpoint();moveSelected(-10000,0,0);assert.ok(selected.value!.x>=0);undo();redo()
}
// Structural pieces ignore the last general setting on creation and on import.
state.room=defaultRoom();state.objects=[];state.collisions=false;add('column');add('beam')
assert.ok(state.objects.every(object=>object.collisions===true));assert.equal(hasObjectCollisions(state.objects,state.room,true),false)
for(const version of [1,2,3,4,5]){
 await load(new File([JSON.stringify({version,units:'mm',room,collisions:false,objects:[{...box,id:'column',type:'column',collisions:false}]})],'structure.json'))
 assert.equal(state.error,'');assert.equal(selected.value,undefined);assert.equal(state.objects[0]!.collisions,true)
}
// All structural pairs may overlap, regardless of either flag or the master.
for(const left of ['beam','column'] as const)for(const right of ['beam','column'] as const){
 const a:Box={...box,id:'left',type:left},b:Box={...box,id:'right',type:right,x:0}
 for(const enabled of [false,true]){
  assert.equal(intersectsObjects({...a,x:0},[b],room,enabled),false)
  assert.equal(hasObjectCollisions([{...a,x:0},b],room,enabled),false)
  assert.equal(limitMovement(a,room,{x:1000,y:0,z:0},[b],enabled).position.x,1000)
 }
 await load(new File([JSON.stringify({version:5,units:'mm',room,objects:[{...a,x:0},b]})],'overlap.json'))
 assert.equal(state.error,'')
 state.selected='left';edit('width','800');assert.equal(selected.value!.width,800)
 moveSelected(1000,0,0);assert.equal(selected.value!.x,1000)
}
// One shared color applies on creation, import and duplication, independent of snap.
state.room=defaultRoom();state.objects=[];state.structuralColor=WALL_COLOR;state.snap=false
add('column');add('beam');add('box')
const furnitureColor=selected.value!.color
assert.ok(state.objects.slice(0,2).every(object=>object.color===WALL_COLOR))
editStructuralColor('#cc8855');assert.equal(state.structuralColor,'#cc8855')
assert.ok(state.objects.slice(0,2).every(object=>object.color==='#cc8855'))
assert.equal(selected.value!.color,furnitureColor)
undo();assert.equal(state.structuralColor,WALL_COLOR);assert.ok(state.objects.slice(0,2).every(object=>object.color===WALL_COLOR))
redo();assert.equal(state.structuralColor,'#cc8855')
state.selected=state.objects[0]!.id;edit('color','#123456');assert.equal(selected.value!.color,'#cc8855')
moveSelected(1820,0,0);assert.equal(selected.value!.color,'#cc8855')
state.snap=true;snapSelected(['x']);assert.equal(selected.value!.color,'#cc8855')
duplicate();assert.equal(selected.value!.color,'#cc8855')
add('beam');assert.equal(selected.value!.color,'#cc8855')
let stored:string|null=null
const autosave=startAutosave(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value}}))
editStructuralColor('#445566');await nextTick();assert.equal(JSON.parse(stored!).structuralColor,'#445566')
assert.ok(JSON.parse(stored!).objects.filter((object:Box)=>object.type==='beam'||object.type==='column').every((object:Box)=>object.color==='#445566'))
autosave.stop();const saved=projectJSON()
editStructuralColor('#123456');await load(new File([saved],'saved.json'));assert.equal(state.structuralColor,'#445566');assert.equal(state.error,'')
const restored=startAutosave(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value}}));assert.equal(state.structuralColor,'#445566');restored.stop()
for(const version of [1,2,3,4,5]){
 await load(new File([JSON.stringify({version,units:'mm',room,objects:[{...box,type:'beam',color:'#123456'}]})],'legacy.json'))
 assert.equal(state.structuralColor,WALL_COLOR);assert.equal(state.objects[0]!.color,WALL_COLOR)
}
const unchanged=projectJSON()
for(const structuralColor of ['red',null,123]){
 await load(new File([JSON.stringify({version:5,units:'mm',room,objects:[],structuralColor})],'invalid.json'))
 assert.equal(projectJSON(),unchanged)
}
console.log('Structural overlap exceptions, forced collisions with other types, shared color, history, versions 1–5 and persistence passed.')
