import assert from 'node:assert/strict'
import { state, defaultRoom, add, selected, dragOpeningToWall, checkpoint, undo, redo, projectJSON, load } from '../src/editor.ts'
const visible={north:true,south:true,east:true,west:true}
for(const type of ['door','window'] as const){
 state.room=defaultRoom();state.objects=[];state.collisions=true;state.snap=true;state.step=50
 add(type);const y=selected.value!.y,w=selected.value!.width
 checkpoint()
 dragOpeningToWall(2060,0,{north:true,west:true,east:false,south:false})
 assert.equal(selected.value!.wall,'north')
 const start=JSON.stringify(selected.value)
 dragOpeningToWall(2060,0,{north:false,west:true,east:true,south:false})
 assert.equal(selected.value!.wall,'north')
 assert.equal(JSON.stringify(selected.value),start)
 undo();checkpoint()
 for(const [wall,x,z] of [['east',2060,123],['south',123,1810],['west',-2060,123],['north',123,-1810]] as const){
  dragOpeningToWall(x,z,visible);assert.equal(selected.value!.wall,wall);assert.equal(selected.value!.y,y);assert.equal(selected.value!.width,w)
  assert.equal(wall==='north'||wall==='south'?selected.value!.x:selected.value!.z,100)
 }
 undo();assert.equal(selected.value!.wall,'north');assert.equal(selected.value!.offset,2000)
 redo();assert.equal(selected.value!.x,100)
 state.room.walls.east=false;dragOpeningToWall(2060,-1500,visible);assert.notEqual(selected.value!.wall,'east')
 state.room.walls.east=true;state.snap=false;dragOpeningToWall(2060,123,visible);assert.equal(selected.value!.z,123)
 await load(new File([projectJSON()],'wall-drag.json'));assert.equal(selected.value,undefined)
 assert.equal(state.objects[0]!.wall,'east');assert.equal(state.objects[0]!.y,y)
}
state.room=defaultRoom();state.objects=[];state.collisions=true;add('door');const door=selected.value!;add('window');const window=selected.value!
// An occupied target wall rejects the new placement without changing either opening.
window.wall='east';window.offset=1750;window.x=2060;window.z=0;state.selected=door.id
dragOpeningToWall(2060,0,visible);assert.equal(door.wall,'north')
console.log('Opening wall drag: four walls, snap, height preservation, disabled walls, collisions, undo/redo and JSON passed.')
