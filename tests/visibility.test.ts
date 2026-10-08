import assert from 'node:assert/strict'
import { state, selectObject, selection, toggleObjectVisibility, projectJSON, parseProject, undo, redo, moveSelected, defaultRoom, type Box } from '../src/editor.ts'
import { hasObjectCollisions } from '../src/objectCollisions.ts'
const box:Box={id:'a',name:'a',type:'box',x:0,y:0,z:0,width:400,height:400,depth:400,color:'#ffffff',collisions:true}
state.room=defaultRoom();state.objects=[box,{...box,id:'b',x:800}];state.selected='a';state.selection=[];state.collisions=true
selectObject('b',true);toggleObjectVisibility('a');assert.equal(state.objects[0]!.hidden,true);assert.deepEqual(selection.value.map(o=>o.id),['b'])
moveSelected(0,0,0);assert.equal(state.objects[1]!.x,0);assert.equal(hasObjectCollisions(state.objects,state.room,true),false)
assert.equal(parseProject(projectJSON()).objects[0]!.hidden,true)
toggleObjectVisibility('a');assert.equal(state.objects[0]!.hidden,true);assert.ok(state.error)
moveSelected(800,0,0);toggleObjectVisibility('a');assert.equal(state.objects[0]!.hidden,false);assert.equal(state.error,'')
undo();assert.equal(state.objects[0]!.hidden,true);redo();assert.equal(state.objects[0]!.hidden,false)
const invalid=JSON.parse(projectJSON());invalid.objects[0].hidden='yes';assert.throws(()=>parseProject(JSON.stringify(invalid)))
console.log('Visibility: selection, freed collision space, occupied reveal, history and JSON passed.')
