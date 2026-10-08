import assert from 'node:assert/strict'
import { defaultRoom, state, selected, toggleBaseboard, moveSelected, resizeSelectedFromFace, edit, undo, redo, parseProject, type Box, type WallSide } from '../src/editor.ts'
import { intersectsObjects, hasObjectCollisions } from '../src/objectCollisions.ts'
import { limitMovement } from '../src/collisions.ts'

const room={...defaultRoom(),baseboard:true}
const furniture:Box={id:'furniture',type:'box',name:'Mueble',x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e',collisions:false}
for(const side of ['north','south','west','east'] as WallSide[]){
 const axis=side==='north'||side==='south'?'z':'x',sign=side==='north'||side==='west'?-1:1
 const edge=(axis==='x'?room.width:room.depth)/2
 const touching={...furniture,[axis]:sign*(edge-300-12)}
 const overlap={...touching,[axis]:sign*(edge-300)}
 assert.equal(intersectsObjects(touching,[],room,false),false)
 assert.equal(intersectsObjects(overlap,[],room,false),true)
 assert.equal(hasObjectCollisions([overlap],room,false),true)
 assert.equal(intersectsObjects({...overlap,y:80},[],room,false),false)
 assert.equal(intersectsObjects(overlap,[],{...room,baseboard:false},false),false)
 assert.equal(intersectsObjects(overlap,[],{...room,walls:{...room.walls,[side]:false}},false),false)
 const result=limitMovement(furniture,room,{...furniture,[axis]:sign*10000},[],false)
 assert.equal(result.blocked,true)
 assert.equal(result.position[axis],touching[axis])
 const slide=limitMovement(touching,room,{...touching,[axis]:sign*10000,[axis==='x'?'z':'x']:100},[],false)
 assert.equal(slide.position[axis],touching[axis])
 assert.equal(slide.position[axis==='x'?'z':'x'],100)
}
const column:Box={...furniture,id:'column',type:'column',width:400,depth:400,height:2500,z:-1550}
const nearColumn={...furniture,z:-1044}
assert.equal(intersectsObjects(nearColumn,[column],room,false),true)
assert.equal(intersectsObjects({...nearColumn,z:-1038},[column],room,false),false)
assert.equal(hasObjectCollisions([column,nearColumn],room,false),true)
assert.equal(hasObjectCollisions([nearColumn,column],room,false),true)
const door:Box={...furniture,id:'door',type:'door',wall:'north',offset:2000,width:900,height:2100,depth:120,z:-1810}
assert.equal(intersectsObjects({...furniture,z:-1450},[door],room,false),false)
assert.equal(intersectsObjects(door,[door],room,false),false)
assert.equal(intersectsObjects(column,[column],room,false),false)

state.room={...room,baseboard:false};state.objects=[{...furniture,z:-1450}];state.selected=furniture.id;state.snap=false;state.wallSnap=false;state.collisions=false
toggleBaseboard();assert.equal(state.room.baseboard,false);assert.match(state.error,/rodapié/)
state.objects[0]!.z=0;toggleBaseboard();assert.equal(state.room.baseboard,true)
undo();assert.equal(state.room.baseboard,false);redo();assert.equal(state.room.baseboard,true)
moveSelected(0,0,-10000);assert.equal(selected.value!.z,-1438)
edit('depth','700');assert.equal(selected.value!.depth,600)
resizeSelectedFromFace({...selected.value!},'depth',700,-1,{x:0,y:0,z:1})
assert.ok(selected.value!.depth<600.001)
assert.throws(()=>parseProject(JSON.stringify({version:6,units:'mm',room,objects:[{...furniture,z:-1450}],collisions:false})),/objects/)
assert.equal(intersectsObjects(furniture,[],null,false),false)
console.log('Baseboard collisions: four walls, continuous movement, sliding, height, columns, door cutouts, disabled collisions, resize, numeric edits, toggle, history and import passed.')
