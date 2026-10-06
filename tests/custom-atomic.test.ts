import assert from 'node:assert/strict'
import { state, beginCustomObject, add, saveCustomObject, insertCustomObject, selected, canUngroup, selectObject, groupSelected, ungroupSelected, duplicate, undo, redo, projectJSON, load } from '../src/editor.ts'

state.room=null;state.objects=[];state.customObjects=[];state.collisions=false
beginCustomObject();add('box');add('cylinder');saveCustomObject('Compuesto')
const template=state.customObjects[0]!
assert.equal(insertCustomObject(template.id),true)
const custom=selected.value!
assert.equal(custom.atomic,true);assert.equal(canUngroup.value,false)
const original=JSON.stringify(state.objects)
ungroupSelected();assert.equal(JSON.stringify(state.objects),original)
duplicate();assert.equal(selected.value!.atomic,true);assert.equal(canUngroup.value,false)
undo();redo();assert.equal(selected.value!.atomic,true);undo()
add('box');selectObject(custom.id,true);groupSelected()
assert.equal(canUngroup.value,true);assert.equal(selected.value!.children!.length,2)
ungroupSelected();assert.equal(state.objects.length,2)
selectObject(custom.id);assert.equal(selected.value!.atomic,true);assert.equal(canUngroup.value,false)
await load(new File([projectJSON()],'atomic.json'))
selectObject(custom.id);assert.equal(canUngroup.value,false);assert.equal(selected.value!.children!.length,2)
const invalid=JSON.parse(projectJSON());invalid.objects.find((o:{id:string})=>o.id===custom.id).atomic='yes'
await load(new File([JSON.stringify(invalid)],'invalid.json'));assert.ok(state.error);assert.equal(selected.value!.atomic,true)
beginCustomObject(template.id);assert.equal(state.objects.length,2)
assert.ok(state.objects.every(o=>o.type!=='group'))
console.log('Atomic custom objects: ungroup protection, outer grouping, duplication, history, JSON validation and template editing passed.')
