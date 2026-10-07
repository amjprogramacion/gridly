import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {state,defaultRoom,beginCustomObject,cancelCustomObject,saveCustomObject,insertCustomObject,add,edit,selected,undo,redo,projectJSON,load,startAutosave} from '../src/editor.ts'
import {validateGroups} from '../src/groups.ts'
state.room=defaultRoom();state.objects=[];state.customObjects=[]
beginCustomObject();add('box');edit('width','200');add('cylinder');edit('width','150');assert.equal(saveCustomObject('Forma 1'),true)
const id=state.customObjects[0]!.id,original=JSON.stringify(state.customObjects[0]!)
assert.equal(insertCustomObject(id),true);const room=JSON.stringify(state.objects)
beginCustomObject();assert.equal(insertCustomObject('missing'),false);assert.equal(insertCustomObject(id),true)
const copy=selected.value!,source=state.customObjects[0]!.object
for(const member of validateGroups([copy])){assert.ok(!validateGroups([source]).some(o=>o.id===member.id));assert.equal(member.collisions,false)}
assert.notStrictEqual(copy.children,source.children);assert.notStrictEqual(copy.children![0],source.children![0])
undo();assert.equal(state.objects.length,0);redo();assert.equal(state.objects.length,1)
edit('width','500');edit('x','400');edit('rotationY','30');selected.value!.children![0]!.color='#abcdef'
assert.equal(JSON.stringify(state.customObjects[0]!),original)
assert.equal(JSON.stringify(JSON.parse(projectJSON()).objects),room)
const values=new Map<string,string>(),autosave=startAutosave(()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)}}))
await nextTick();const draft=projectJSON();autosave.stop();cancelCustomObject();assert.equal(JSON.stringify(state.objects),room)
await load(new File([draft],'draft.json'));assert.equal(state.objects[0]?.width,500)
assert.equal(saveCustomObject('Forma 2'),true);assert.equal(JSON.stringify(state.objects),room);assert.equal(JSON.stringify(state.customObjects[0]!),original)
assert.equal(state.customObjects.length,2)
beginCustomObject(id);assert.equal(insertCustomObject(id),false);assert.equal(insertCustomObject(state.customObjects[1]!.id),true);cancelCustomObject()
beginCustomObject();assert.equal(insertCustomObject(id),true);const first=state.objects[0]!.id;assert.equal(insertCustomObject(id),true);assert.notEqual(state.objects[1]!.id,first);edit('height','700');cancelCustomObject()
assert.equal(JSON.stringify(state.objects),room);assert.equal(JSON.stringify(state.customObjects[0]!),original)
console.log('Workshop templates: independent nested copies, transformations, repeated insertion, save/cancel, undo/redo, autosave and JSON passed.')

