import assert from 'node:assert/strict'
import { state, defaultRoom, add, edit, selectObject, selection, copySelection, pasteSelection, duplicate, undo, redo, history } from '../src/editor.ts'
import { validateGroups } from '../src/groups.ts'
state.room={...defaultRoom(),width:8000,depth:7000};state.objects=[];state.collisions=true;state.snap=false;state.wallSnap=false
assert.equal(copySelection(),false);assert.equal(pasteSelection(),false)
add('box');add('cylinder');const original=state.objects.map(object=>({...object}));selectObject(original[0]!.id);selectObject(original[1]!.id,true)
assert.equal(copySelection(),true);selectObject(original[0]!.id);edit('height','800')
const before=JSON.stringify(state.objects);assert.equal(pasteSelection(['box','cylinder']),true);const copies=state.objects.slice(2)
assert.equal(copies.length,2);assert.equal(copies[0]!.height,600);assert.equal(copies[1]!.x-copies[0]!.x,original[1]!.x-original[0]!.x);assert.equal(copies[1]!.z-copies[0]!.z,original[1]!.z-original[0]!.z);assert.equal(selection.value.length,2)
assert.ok(copies.every(object=>!original.some(source=>source.id===object.id)))
undo();assert.equal(JSON.stringify(state.objects),before);redo();assert.equal(state.objects.length,4)
assert.equal(pasteSelection(['box','cylinder']),true);assert.equal(state.objects.length,6);assert.equal(new Set(state.objects.map(o=>o.id)).size,6)
assert.equal(duplicate(),true);assert.equal(state.objects.length,8);assert.equal(selection.value.length,2)
state.objects=[];state.room=defaultRoom();add('door');assert.equal(copySelection(),true);assert.equal(pasteSelection(['box','cylinder','group']),false);assert.equal(state.objects.length,1);assert.equal(pasteSelection(['door','window','beam','column']),true);assert.equal(state.objects.length,2);assert.ok(state.objects.every(o=>o.wall==='north'&&o.width===900&&o.y===0))
state.objects=[{id:'full-room',name:'Full',type:'box',x:0,y:0,z:0,width:4000,height:2500,depth:3500,color:'#779b8e',collisions:true}];selectObject('full-room');copySelection();const full=JSON.stringify(state.objects),checkpoints=history.undo;assert.equal(pasteSelection(),false);assert.equal(JSON.stringify(state.objects),full);assert.equal(history.undo,checkpoints)
state.room=null;state.objects=[{id:'g',name:'Group',type:'group',x:0,y:0,z:0,width:1000,height:100,depth:100,color:'#779b8e',collisions:false,groupSize:{width:1000,height:100,depth:100},children:[{id:'a',name:'A',type:'box',x:-450,y:0,z:0,width:100,height:100,depth:100,color:'#779b8e',collisions:false},{id:'b',name:'B',type:'cylinder',x:450,y:0,z:0,width:100,height:100,depth:100,color:'#779b8e',collisions:false}]}];selectObject('g');copySelection();assert.equal(pasteSelection(['group']),true);const all=validateGroups(state.objects);assert.equal(all.length,6);assert.equal(new Set(all.map(o=>o.id)).size,6)
console.log('Clipboard: immutable copies, multi-selection layout, fresh group IDs, mode filtering, openings, atomic placement failures, duplicate and history passed.')
