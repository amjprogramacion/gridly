import assert from 'node:assert/strict'
import { intersectsWall, limitMovement } from '../src/collisions.ts'
import { state, defaultRoom, add, moveSelected, edit, editRoom, toggleWall, duplicate, checkpoint, undo, redo, load } from '../src/editor.ts'
state.collisions=false
import type { Box, ObjectKind } from '../src/editor.ts'
const room=defaultRoom()
const box:Box={id:'test',name:'Prisma',type:'box',x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e'}
assert.equal(intersectsWall({...box,x:1700},room),false);assert.equal(intersectsWall({...box,x:1701},room),true)
assert.equal(limitMovement(box,room,{x:10000,y:0,z:0}).position.x,1700)
assert.equal(limitMovement(box,room,{x:-10000,y:0,z:0}).position.x,-1700)
assert.equal(limitMovement(box,room,{x:0,y:0,z:10000}).position.z,1450)
assert.equal(limitMovement(box,room,{x:0,y:0,z:-10000}).position.z,-1450)
const diagonal=limitMovement(box,room,{x:10000,y:0,z:1000});assert.equal(diagonal.position.x,1700);assert.equal(diagonal.position.z,1000)
const corner=limitMovement(box,room,{x:10000,y:0,z:10000});assert.equal(corner.position.x,1700);assert.equal(corner.position.z,1450)
assert.deepEqual(limitMovement({...box,x:1700},room,{x:1500,y:0,z:800}).position,{x:1500,y:0,z:800})
assert.equal(limitMovement({...box,x:3000},room,{x:0,y:0,z:0}).position.x,2420)
assert.deepEqual(limitMovement(box,room,{x:10000,y:10000,z:0}).position,{x:1700,y:1900,z:0})
room.walls.east=false;assert.equal(limitMovement(box,room,{x:10000,y:0,z:0}).blocked,false);room.walls.east=true
for(const type of ['box','column','beam'] as ObjectKind[]){
 state.room=defaultRoom();state.objects=[];state.snap=false;add(type)
 const o=state.objects[0]!,before={...o};checkpoint();moveSelected(10000,o.y,0,['x']);assert.equal(o.x,(4000-o.width)/2);assert.equal(intersectsWall(o,state.room),false);undo();assert.equal(state.objects[0]!.x,before.x);redo();assert.equal(state.objects[0]!.x,(4000-o.width)/2)
 edit('x','-10000');assert.equal(state.objects[0]!.x,-(4000-o.width)/2 || 0)
 const oldWidth=state.objects[0]!.width;edit('width','5000');assert.equal(state.objects[0]!.width,oldWidth);assert.ok(state.error)
 duplicate();assert.equal(intersectsWall(state.objects[1]!,state.room),false)
}
state.room=defaultRoom();state.objects=[];add('box');moveSelected(1600,0,0);checkpoint();editRoom('width','2000');assert.equal(state.room!.width,2000);assert.equal(state.objects[0]!.x,700);assert.equal(intersectsWall(state.objects[0]!,state.room),false);undo();assert.equal(state.room!.width,4000);assert.equal(state.objects[0]!.x,1600)
editRoom('width','200');assert.equal(state.room!.width,4000);assert.ok(state.error)
toggleWall('east');moveSelected(5000,0,0);assert.equal(state.objects[0]!.x,5000);toggleWall('east');assert.equal(state.objects[0]!.x,1700);assert.equal(intersectsWall(state.objects[0]!,state.room),false)
add('door');edit('offset','0');assert.equal(state.objects.at(-1)!.offset,450);assert.equal(intersectsWall(state.objects.at(-1)!,state.room),false)
add('window');edit('height','5000');assert.equal(state.objects.at(-1)!.height,2500);assert.equal(state.objects.at(-1)!.y,0)
const prior=JSON.stringify(state.objects)
await load(new File([JSON.stringify({version:3,units:'mm',room:defaultRoom(),objects:[{...box,x:1900}]})],'collision.json'));assert.equal(JSON.stringify(state.objects),prior);assert.ok(state.error.includes('atraviesan'))
console.log('Wall collisions: all object types, high-speed moves, sliding, corners, numeric edits, resizing, room edits, disabled walls, import and history passed.')

state.selected=state.objects.at(-1)!.id;const frameDepth=state.objects.at(-1)!.depth;edit('depth','10000');assert.equal(state.objects.at(-1)!.depth,frameDepth);assert.ok(state.error.includes('marco'))
edit('wall','east');assert.equal(intersectsWall(state.objects.at(-1)!,state.room),false)
