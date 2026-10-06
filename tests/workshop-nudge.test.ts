import assert from 'node:assert/strict'
import { cameraArrowDirection } from '../src/keyboardMovement.ts'
import { state, add, beginCustomObject, cancelCustomObject, selectObject, nudgeWorkshopSelection, undo, redo } from '../src/editor.ts'

state.objects=[];add('box')
const roomObjects=JSON.stringify(state.objects)
nudgeWorkshopSelection({x:1,z:0})
assert.equal(JSON.stringify(state.objects),roomObjects)
beginCustomObject();add('box')
let first=state.objects[0]!
first.x=12.5;first.y=35;first.z=-7.5
for(const step of [5,10,50,100]){
 state.snap=true;state.step=step
 const x=first.x
 nudgeWorkshopSelection({x:1,z:0});assert.equal(first.x,x+step)
 undo();assert.equal(state.objects[0]!.x,x)
 redo();assert.equal(state.objects[0]!.x,x+step)
 first=state.objects[0]!
 nudgeWorkshopSelection({x:-1,z:0});assert.equal(first.x,x)
 nudgeWorkshopSelection({x:0,z:-1});assert.equal(first.z,-7.5-step)
 nudgeWorkshopSelection({x:0,z:1});assert.equal(first.z,-7.5)
 assert.equal(first.y,35)
}
state.step=50
const position={x:first.x,z:first.z}
nudgeWorkshopSelection({x:3,z:-4})
assert.equal(first.x,position.x);assert.equal(first.z,position.z-50)
undo();first=state.objects[0]!
state.snap=false;nudgeWorkshopSelection({x:1,z:0});assert.equal(first.x,13.5)
add('cylinder')
selectObject(first.id,true)
const before=state.objects.map(o=>({x:o.x,z:o.z,y:o.y}))
state.snap=true;state.step=10;nudgeWorkshopSelection({x:0,z:1})
assert.deepEqual(state.objects.map(o=>({x:o.x,z:o.z,y:o.y})),before.map(o=>({...o,z:o.z+10})))
undo();assert.deepEqual(state.objects.map(o=>({x:o.x,z:o.z,y:o.y})),before)
selectObject('');const empty=JSON.stringify(state.objects);nudgeWorkshopSelection({x:1,z:0});assert.equal(JSON.stringify(state.objects),empty)
cancelCustomObject();assert.equal(JSON.stringify(state.objects),roomObjects)
for(const right of [{x:1,z:0},{x:0,z:-1},{x:-1,z:0},{x:3,z:-4}]){
 const forward=cameraArrowDirection('ArrowUp',right)!,back=cameraArrowDirection('ArrowDown',right)!,left=cameraArrowDirection('ArrowLeft',right)!,r=cameraArrowDirection('ArrowRight',right)!
 assert.ok(Math.abs(Math.hypot(forward.x,forward.z)-1)<1e-10)
 assert.ok(Math.abs(forward.x*r.x+forward.z*r.z)<1e-10)
 assert.equal(Math.abs(r.x)+Math.abs(r.z),1)
 assert.ok(r.x===0||r.z===0)
 assert.ok(forward.x===0||forward.z===0)
 assert.equal(back.x,-forward.x);assert.equal(back.z,-forward.z)
 assert.equal(left.x,-r.x);assert.equal(left.z,-r.z)
}
assert.deepEqual(cameraArrowDirection('ArrowUp',{x:0,z:-1}),{x:-1,z:-0})
assert.equal(cameraArrowDirection('ArrowUp',{x:0,z:0}),null)
assert.deepEqual(cameraArrowDirection('ArrowRight',{x:3,z:-4}),{x:0,z:-1})
assert.deepEqual(cameraArrowDirection('ArrowUp',{x:3,z:-4}),{x:-1,z:-0})
assert.deepEqual(cameraArrowDirection('ArrowRight',{x:4,z:-3}),{x:1,z:0})
assert.deepEqual(cameraArrowDirection('ArrowRight',{x:1,z:1}),{x:1,z:0})
console.log('Workshop arrows: exact snap increments, off-grid positions, disabled snap, selection, undo/redo and room isolation passed.')
