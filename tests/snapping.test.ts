import assert from 'node:assert/strict'
import { snapPosition, touchingWalls } from '../src/snapping.ts'
import { state, defaultRoom, add, moveSelected, checkpoint, undo, redo, snapSelected, edit } from '../src/editor.ts'
state.collisions=false
import type { Box } from '../src/editor.ts'
const room=defaultRoom()
const column:Box={id:'column',type:'column',name:'Columna',x:0,y:0,z:0,width:301,height:2500,depth:300,color:'#a0aaba'}
const options={enabled:true,walls:true,step:100,axes:['x','y','z'] as ('x'|'y'|'z')[]}
let result=snapPosition(column,room,[],{x:-1820,y:0,z:-1580},options)
assert.equal(result.position.x,-1849.5);assert.equal(result.position.z,-1600);assert.ok(result.contacts.some(c=>c.label==='Pared oeste'))
assert.equal(snapPosition(column,room,[],{x:1800,y:0,z:0},options).position.x,1849.5)
assert.equal(snapPosition(column,room,[],{x:0,y:0,z:1580},options).position.z,1600)
assert.equal(snapPosition(column,room,[],{x:-1700,y:0,z:0},options).position.x,-1700)
assert.equal(snapPosition(column,room,[],{x:-1820,y:0,z:0},{...options,enabled:false}).position.x,-1820)
assert.equal(snapPosition(column,room,[],{x:-1820,y:0,z:0},{...options,walls:false}).position.x,-1800)
room.walls.west=false;assert.equal(snapPosition(column,room,[],{x:-1820,y:0,z:0},options).position.x,-1800);room.walls.west=true
assert.equal(snapPosition(column,room,[],{x:-1820,y:0,z:-1580},{...options,axes:['x']}).position.z,-1580)
assert.equal(snapPosition(column,room,[],{x:-1820,y:2700,z:0},options).contacts.some(c=>c.axis==='x'),false)
const beam={...column,type:'beam' as const,width:500,height:250,depth:300}
assert.equal(snapPosition(beam,room,[],{x:0,y:2210,z:0},options).position.y,2250)
const opening:Box={...column,id:'window',type:'window',wall:'north',offset:2000,width:1200,height:1000,y:900}
const small={...beam,width:300,height:300,depth:200}
assert.equal(snapPosition(small,room,[opening],{x:0,y:1100,z:-1600},options).contacts.some(c=>c.label==='Pared norte'),false)
assert.ok(snapPosition(small,room,[opening],{x:1200,y:1100,z:-1600},options).contacts.some(c=>c.label==='Pared norte'))
// Integration: a single move is undoable, exact typed position is preserved when snap is off.
state.room=defaultRoom();state.objects=[];state.snap=true;state.wallSnap=true;state.step=100;add('column');checkpoint();moveSelected(-1820,0,-1580,['x','z']);assert.equal(state.objects[0]!.x,-1850);assert.equal(state.objects[0]!.z,-1600);undo();assert.equal(state.objects[0]!.x,-1000);redo();assert.equal(state.objects[0]!.x,-1850)
assert.ok(touchingWalls(state.objects[0]!,state.room!,state.objects).some(c=>c.label==='Pared norte'))
edit('x','1830');snapSelected(['x']);assert.equal(state.objects[0]!.x,1850)
state.snap=false;edit('x','1830');snapSelected(['x']);assert.equal(state.objects[0]!.x,1830)
console.log('Wall snap: faces, corners, openings, disabled walls, axes, grid priority, height and history passed.')
