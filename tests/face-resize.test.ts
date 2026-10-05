import assert from 'node:assert/strict'
import { resizedFromFace } from '../src/faceResize.ts'
import { state, defaultRoom, selected, resizeSelectedFromFace, checkpoint, undo } from '../src/editor.ts'
state.collisions=false
import { intersectsWall } from '../src/collisions.ts'
const box={id:'resize',name:'Prisma',x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e'}
const wider=resizedFromFace(box,'width',1000,1,{x:1,y:0,z:0})
assert.equal(wider.x-wider.width/2,box.x-box.width/2)
const taller=resizedFromFace(box,'height',900,1,{x:0,y:1,z:0})
assert.equal(taller.y,0)
const rotated=resizedFromFace({...box,rotationY:90},'width',1000,1,{x:0,y:0,z:-1})
assert.equal(rotated.z,-200)
assert.equal(rotated.x,0)
state.room=defaultRoom();state.objects=[{...box,x:1600}];state.selected=box.id;state.snap=false
const original={...selected.value!};checkpoint()
resizeSelectedFromFace(original,'width',1800,1,{x:1,y:0,z:0})
assert.equal(intersectsWall(selected.value!,state.room),false)
assert.ok(Math.abs(selected.value!.x+selected.value!.width/2-2000)<.001)
assert.equal(selected.value!.x-selected.value!.width/2,1300)
undo();assert.equal(selected.value!.width,600)
resizeSelectedFromFace({...selected.value!},'height',1200,-1,{x:0,y:1,z:0})
assert.equal(selected.value!.y,0);assert.ok(selected.value!.height<600.001)
const window=resizedFromFace({...box,type:'window',y:1000,offset:2000},'height',900,-1,{x:0,y:1,z:0})
assert.equal(window.y+window.height,1600)
console.log('Face resize: fixed opposite face, rotated axes, floor, wall limits, openings and undo passed.')
