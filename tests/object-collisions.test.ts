import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { collisionPeers, overlaps, intersectsObjects, hasObjectCollisions } from '../src/objectCollisions.ts'
import { limitMovement, intersectsRoom } from '../src/collisions.ts'
import { state, selected, collisionSelection, defaultRoom, add, duplicate, edit, moveSelected, normalizeOpening, toggleCollisions, toggleSelectedCollisions, undo, redo, resizeSelectedFromFace, rotateSelected, editRoom, load, projectJSON, startAutosave, history } from '../src/editor.ts'
import type { Box, ObjectKind } from '../src/editor.ts'
const room=defaultRoom()
const box:Box={id:'a',name:'A',type:'box',x:-1000,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e'}
const obstacle:Box={...box,id:'b',name:'B',x:0}
assert.equal(overlaps({...box,x:-600},obstacle),false)
assert.equal(overlaps({...box,x:-599},obstacle),true)
for(const type of ['box','column','beam','door','window'] as ObjectKind[]){
 const peer={...obstacle,type,wall:'north' as const,offset:2000}
 assert.equal(intersectsObjects({...box,x:0},[peer],room,true),true)
 assert.equal(intersectsObjects({...box,x:0,collisions:false},[peer],room,true),false)
 assert.equal(intersectsObjects({...box,x:0},[{...peer,collisions:false}],room,true),false)
 assert.equal(intersectsObjects({...box,x:0},[peer],room,false),false)
}
assert.equal(collisionPeers(box,[box,obstacle],room,true).length,1)
assert.equal(collisionPeers(box,[{...obstacle,type:'door',wall:'north'}],{...room,walls:{...room.walls,north:false}},true).length,0)
assert.equal(limitMovement(box,room,{x:1500,y:0,z:0},[obstacle],true).position.x,-600)
assert.equal(limitMovement(box,null,{x:10000,y:0,z:0},[obstacle],true).position.x,-600)
assert.deepEqual(limitMovement(box,null,{x:10000,y:0,z:1000},[obstacle],true).position,{x:-600,y:0,z:1000})
assert.deepEqual(limitMovement({...box,x:-600},room,{x:-1000,y:0,z:1000},[obstacle],true).position,{x:-1000,y:0,z:1000})
assert.equal(limitMovement(box,room,{x:1500,y:0,z:0},[obstacle],false).position.x,1500)
const above={...obstacle,y:1000}
assert.equal(limitMovement({...box,x:0},room,{x:0,y:10000,z:0},[above],true).position.y,400)
assert.equal(limitMovement({...box,x:0,y:1800},room,{x:0,y:0,z:0},[above],true).position.y,1600)
const rotated={...obstacle,rotationY:45}
assert.equal(overlaps({...box,x:-650},rotated),true)
assert.equal(limitMovement(box,room,{x:10000,y:0,z:0},[rotated],true).blocked,true)

function reset(objects:Box[]=[box,obstacle]){state.room=defaultRoom();state.objects=objects.map(o=>({...o}));state.selected=objects[0]?.id??'room';state.collisions=true;state.snap=false;state.error=''}
reset();edit('x','10000');assert.equal(selected.value!.x,-600);assert.equal(state.collisionBlocked,true)
undo();assert.equal(selected.value!.x,-1000);redo();assert.equal(selected.value!.x,-600)
reset();toggleSelectedCollisions();assert.equal(selected.value!.collisions,false)
moveSelected(0,0,0);assert.equal(selected.value!.x,0)
toggleSelectedCollisions();assert.equal(selected.value!.collisions,false);assert.match(state.error,/solapa/)
moveSelected(-1000,0,0);toggleSelectedCollisions();assert.equal(selected.value!.collisions,true)
undo();assert.equal(selected.value!.collisions,false);redo();assert.equal(selected.value!.collisions,true)
toggleCollisions();assert.equal(state.collisions,false);moveSelected(0,0,0)
toggleCollisions();assert.equal(state.collisions,false);assert.match(state.error,/solapados/)
moveSelected(-1000,0,0);toggleCollisions();assert.equal(state.collisions,true)
assert.ok(state.objects.every(object=>object.collisions===true))
toggleSelectedCollisions();assert.equal(collisionSelection.value.mixed,true)
// A disabled peer does not block the other object, but neither flag removes room limits.
state.selected=obstacle.id;moveSelected(-1000,0,0);assert.equal(selected.value!.x,-1000)
state.selected=box.id;moveSelected(-10000,10000,0);assert.equal(selected.value!.x,-1700);assert.equal(selected.value!.y,1900)
reset();edit('width','1600');assert.equal(selected.value!.width,600);assert.match(state.error,/solaparía/)
resizeSelectedFromFace({...selected.value!},'width',2000,1,{x:1,y:0,z:0})
assert.ok(Math.abs(selected.value!.width-1000)<1e-5);assert.equal(overlaps(selected.value!,state.objects[1]!),false)
reset([{...box,x:-700,width:200,height:600,depth:1200},obstacle])
rotateSelected({rotationY:90},true);assert.equal(selected.value!.rotationY??0,0);assert.equal(state.collisionBlocked,true)
toggleSelectedCollisions();rotateSelected({rotationY:90},true);assert.equal(selected.value!.rotationY,90)
// Room fitting must never push two participating objects into each other.
reset([{...box,x:-600},{...obstacle,x:600}]);editRoom('width','1000');assert.equal(state.room!.width,4000);assert.match(state.error,/solaparse/)
// Creation and duplication choose a free adjacent position for every type.
for(const type of ['box','column','beam','door','window'] as ObjectKind[]){
 reset([]);add(type);const source=selected.value!.id;duplicate();assert.equal(state.objects.length,2,`duplicate ${type}`)
 assert.notEqual(selected.value!.id,source);assert.equal(hasObjectCollisions(state.objects,state.room,true),false)
 add(type);assert.equal(state.objects.length,3,`add ${type}`);assert.equal(hasObjectCollisions(state.objects,state.room,true),false)
}
reset([]);state.room={...room,width:600,depth:600,height:600};add();const before=history.undo;duplicate()
assert.equal(state.objects.length,1);assert.equal(history.undo,before);assert.ok(state.error)
// Doors and windows are blocked while moving along their wall, including large jumps.
const door:Box={...box,id:'door',type:'door',wall:'north',offset:500,width:600,height:2100,depth:120}
const otherDoor:Box={...door,id:'other-door',offset:2000}
normalizeOpening(door,room);normalizeOpening(otherDoor,room)
reset([door,otherDoor]);edit('offset','3500');assert.equal(selected.value!.offset,1400)
moveSelected(1500,0,-1810);assert.equal(selected.value!.offset,1400)
edit('wall','south');assert.equal(selected.value!.wall,'south')
// JSON round trips both controls; legacy overlaps retain their old editable behavior.
reset();toggleSelectedCollisions();const json=projectJSON()
await load(new File([json],'new.json'));assert.equal(state.collisions,true);assert.equal(state.objects[0]!.collisions,false)
undo();redo();assert.equal(state.objects[0]!.collisions,false)
for(const version of [1,2,3,4]){
 await load(new File([JSON.stringify({version,units:'mm',room,objects:[{...box,x:0},obstacle]})],'legacy.json'))
 assert.equal(state.error,'');assert.equal(state.collisions,false)
}
const unchanged=projectJSON()
await load(new File([JSON.stringify({version:4,units:'mm',room,collisions:true,objects:[{...box,x:0},obstacle]})],'overlap.json'))
assert.equal(projectJSON(),unchanged);assert.match(state.error,/solapados/)
for(const bad of [{collisions:'false',objects:[box]},{collisions:true,objects:[{...box,collisions:1}]}]){
 await load(new File([JSON.stringify({version:4,units:'mm',room,...bad})],'bad.json'));assert.equal(projectJSON(),unchanged)
}
reset();let stored:string|null=null
const autosave=startAutosave(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value}}))
toggleCollisions();toggleSelectedCollisions();await nextTick()
assert.equal(JSON.parse(stored!).collisions,false);assert.equal(JSON.parse(stored!).objects[0].collisions,true)
autosave.stop();state.collisions=true;state.objects=[]
const restored=startAutosave(()=>({getItem:()=>stored,setItem:(_key,value)=>{stored=value}}))
assert.equal(state.collisions,false);assert.equal(state.objects[0]!.collisions,true);assert.equal(collisionSelection.value.mixed,true);restored.stop()
console.log('Object collisions: all types, swept moves, sliding, XYZ bounds, switches, room limits, resize/rotation, placement, openings, history, versions 1–4 and autosave passed.')

// The master modifies all flags, while individual exceptions leave other pairs intact.
const third={...box,id:'c',z:1000},fourth={...obstacle,id:'d',x:1000,z:1000}
reset([box,obstacle,third,fourth]);toggleSelectedCollisions();state.selected=obstacle.id;toggleSelectedCollisions()
assert.equal(collisionSelection.value.mixed,true);assert.equal(collisionSelection.value.checked,false)
assert.ok(state.objects.slice(2).every(object=>object.collisions!==false))
state.selected=box.id;moveSelected(0,0,0);assert.equal(selected.value!.x,0)
state.selected=third.id;moveSelected(10000,0,1000);assert.equal(selected.value!.x,400)
const flags=state.objects.map(object=>object.collisions);toggleCollisions(true)
assert.deepEqual(state.objects.map(object=>object.collisions),flags);assert.match(state.error,/solapados/)
state.selected=box.id;moveSelected(-1000,0,0);toggleCollisions(true)
assert.ok(state.objects.every(object=>object.collisions===true));assert.equal(collisionSelection.value.mixed,false)
undo();assert.deepEqual(state.objects.map(object=>object.collisions),flags);redo()
toggleCollisions();assert.ok(state.objects.every(object=>object.collisions===false));assert.equal(state.collisions,false)
state.selected=third.id;toggleSelectedCollisions();state.selected=fourth.id;toggleSelectedCollisions()
state.selected=third.id;moveSelected(10000,0,1000);assert.equal(selected.value!.x,400)
assert.equal(state.collisions,false);assert.equal(collisionSelection.value.mixed,true)
const mixed=projectJSON();assert.equal(JSON.parse(mixed).version,5)
await load(new File([mixed],'mixed.json'));assert.equal(state.collisions,false);assert.equal(collisionSelection.value.mixed,true)
state.selected=third.id;moveSelected(10000,0,1000);assert.equal(selected.value!.x,400)
// Migration preserves the previous gate without silently enabling old individual flags.
await load(new File([JSON.stringify({version:4,units:'mm',room,collisions:false,objects:[{...box,collisions:true},{...obstacle,collisions:true}]})],'old-switch.json'))
assert.ok(state.objects.every(object=>object.collisions===false))
console.log('Bulk master, independent exceptions, mixed state, unaffected pairs, history and versions 1–5 migration passed.')
