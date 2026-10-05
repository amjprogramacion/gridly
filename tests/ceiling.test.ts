import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { intersectsRoom, limitMovement, fitRoomObject } from '../src/collisions.ts'
import { fitRotation } from '../src/rotationFit.ts'
import { worldDimensions } from '../src/geometry.ts'
import { state, defaultRoom, add, selected, moveSelected, edit, editRoom, checkpoint, undo, redo, beginRotation, endRotation, rotateSelected, resizeSelectedFromFace, duplicate, load, startAutosave } from '../src/editor.ts'
state.collisions=false
import type { Box } from '../src/editor.ts'
const room=defaultRoom()
const box:Box={id:'ceiling',name:'Prisma',type:'box',x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e'}
const top=(object:Box)=>object.y+worldDimensions(object).height
const fits=(object:Box)=>{assert.ok(top(object)<=room.height+1e-7);assert.equal(intersectsRoom(object,room),false)}
assert.equal(intersectsRoom({...box,y:1900},room),false)
assert.equal(intersectsRoom({...box,y:1901},room),true)
assert.equal(intersectsRoom({...box,y:10000},null),false)
assert.deepEqual(limitMovement(box,room,{x:0,y:100000,z:0}),{position:{x:0,y:1900,z:0},blocked:true})
assert.deepEqual(limitMovement({...box,y:1900},room,{x:900,y:10000,z:800}).position,{x:900,y:1900,z:800})
assert.deepEqual(limitMovement({...box,y:1900},room,{x:0,y:1700,z:0}).position,{x:0,y:1700,z:0})
assert.deepEqual(limitMovement(box,room,{x:17000,y:19000,z:14500}).position,{x:1700,y:1900,z:1450})
const openRoom={...room,walls:{north:false,south:false,east:false,west:false}}
assert.deepEqual(limitMovement(box,openRoom,{x:10000,y:10000,z:0}).position,{x:10000,y:1900,z:0})
assert.equal(limitMovement(box,null,{x:0,y:10000,z:0}).position.y,10000)
const rotated={...box,rotationX:45,rotationZ:30}
const moved=limitMovement(rotated,room,{x:0,y:10000,z:0});fits({...rotated,...moved.position})
assert.ok(Math.abs(top({...rotated,...moved.position})-room.height)<1e-7)
const lowered={...box,y:1900};assert.equal(fitRoomObject(lowered,{...room,height:1000}),true);assert.equal(lowered.y,400)
assert.equal(fitRoomObject({...box},{...room,height:500}),false)
// A beam at the ceiling must fit at every XYZ angle and recover within one operation.
const beam:Box={...box,type:'beam',width:4000,height:250,depth:300,y:2250}
for(let angle=-180;angle<=180;angle+=3){
 for(const axis of ['rotationX','rotationY','rotationZ'])fits(fitRotation({...beam,[axis]:angle},room))
 fits(fitRotation({...beam,rotationX:angle,rotationY:angle/2,rotationZ:angle/3},room))
}
state.room=defaultRoom();state.objects=[];state.snap=false;add('beam')
beginRotation();rotateSelected({rotationZ:30});fits(selected.value!);assert.ok(selected.value!.width<4000)
rotateSelected({rotationZ:0});assert.equal(selected.value!.width,4000)
rotateSelected({rotationX:45});fits(selected.value!);endRotation();undo();assert.equal(selected.value!.width,4000);redo();fits(selected.value!)
// Numeric edits, fixed-face handles, history and duplication share the same ceiling.
state.room=defaultRoom();state.objects=[];add('box');checkpoint();moveSelected(0,10000,0,['y'])
assert.equal(selected.value!.y,1900);assert.equal(state.collisionBlocked,true)
undo();assert.equal(selected.value!.y,0);redo();assert.equal(selected.value!.y,1900)
edit('height','601');assert.equal(selected.value!.height,600);assert.match(state.error,/techo/)
edit('y','10000');assert.equal(selected.value!.y,1900)
const original={...selected.value!};checkpoint();resizeSelectedFromFace(original,'height',1600,1,{x:0,y:1,z:0})
fits(selected.value!);assert.ok(Math.abs(selected.value!.height-600)<1e-6);assert.equal(selected.value!.y,original.y)
undo();duplicate();for(const object of state.objects)fits(object)
checkpoint();editRoom('height','1000');assert.equal(state.room!.height,1000);assert.equal(selected.value!.y,400)
undo();assert.equal(state.room!.height,2500);assert.equal(selected.value!.y,1900)
editRoom('height','500');assert.equal(state.room!.height,2500);assert.match(state.error,/techo/)
// Wall openings remain normalized under the ceiling.
add('door');edit('height','5000');assert.equal(selected.value!.height,2500);fits(selected.value!)
add('window');edit('y','10000');fits(selected.value!)
// Legacy formats still load; scenes above the ceiling are rejected without mutation.
for(const version of [1,2,3,4]){
 await load(new File([JSON.stringify({version,units:'mm',room,objects:[box]})],'valid.json'))
 assert.equal(state.error,'');assert.equal(state.objects[0]!.id,box.id)
}
const before=JSON.stringify(state.objects)
await load(new File([JSON.stringify({version:4,units:'mm',room,objects:[{...box,y:1901}]})],'above.json'))
assert.equal(JSON.stringify(state.objects),before);assert.match(state.error,/techo/)
// Old autosaves above the ceiling are preserved and reported, not silently replaced.
const corrupt=JSON.stringify({version:4,units:'mm',room,objects:[{...box,y:1901}]})
let stored=corrupt
const autosave=startAutosave(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value}}))
await nextTick();assert.equal(stored,corrupt);assert.ok(state.autosaveError);assert.equal(JSON.stringify(state.objects),before)
autosave.stop()
console.log('Virtual ceiling: swept movement, sliding, disabled walls, XYZ rotation, resizing, room height, history, openings, import and autosave recovery passed.')
