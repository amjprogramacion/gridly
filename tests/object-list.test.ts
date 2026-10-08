import assert from 'node:assert/strict'
import { state, renameObject, reorderObjects, undo, redo, projectJSON, parseProject, history, type Box } from '../src/editor.ts'
const piece=(id:string,type:Box['type']='box'):Box=>({id,name:id,type,x:type==='column'?1000:0,y:0,z:0,width:100,height:100,depth:100,color:'#779b8e',collisions:false})
state.room=null;state.objects=[piece('a'),piece('structure','column'),piece('b'),piece('c')];state.selected='b';state.selection=['a','b']
const geometry=state.objects.map(o=>({...o}))
reorderObjects(['c','a','b'])
assert.deepEqual(state.objects.map(o=>o.id),['c','structure','a','b'])
assert.equal(state.selected,'b');assert.deepEqual(state.selection,['a','b'])
for(const object of state.objects)assert.deepEqual(object,geometry.find(o=>o.id===object.id))
undo();assert.deepEqual(state.objects.map(o=>o.id),['a','structure','b','c'])
redo();assert.deepEqual(state.objects.map(o=>o.id),['c','structure','a','b'])
renameObject('a','  Mesa  ');assert.equal(state.objects.find(o=>o.id==='a')!.name,'Mesa')
assert.equal(state.selected,'b');undo();assert.equal(state.objects.find(o=>o.id==='a')!.name,'a');redo()
assert.deepEqual(parseProject(projectJSON()).objects.map(o=>[o.id,o.name]),state.objects.map(o=>[o.id,o.name]))
const count=history.undo
renameObject('a','');renameObject('a','x'.repeat(121));renameObject('missing','Name');renameObject('a','Mesa')
reorderObjects(['a','a']);reorderObjects(['missing','a']);reorderObjects(['c','a','b'])
assert.equal(history.undo,count)
console.log('Object list: filtered reorder, selection and geometry preservation, rename validation, history and JSON passed.')
