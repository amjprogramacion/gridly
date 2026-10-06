import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { state, customEditing, customEditingId, defaultRoom, add, edit, undo, redo, beginCustomObject, cancelCustomObject, saveCustomObject, insertCustomObject, load, projectJSON, startAutosave, AUTOSAVE_KEY } from '../src/editor.ts'
state.room=defaultRoom();state.objects=[];state.customObjects=[];state.collisions=true
add('box');const roomObjects=JSON.stringify(state.objects),room=JSON.stringify(state.room),mainName=state.projectName
const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}}
let autosave=startAutosave(()=>storage)
beginCustomObject();assert.equal(customEditing.value,true);assert.equal(state.room,null);assert.equal(state.objects.length,0);assert.equal(state.collisions,false)
assert.equal(saveCustomObject('Empty'),false)
add('box');edit('height','100');add('cylinder');edit('height','800')
assert.equal(state.objects[0]!.x,state.objects[1]!.x);assert.equal(state.objects[0]!.z,state.objects[1]!.z)
await nextTick();let saved=JSON.parse(values.get(AUTOSAVE_KEY)!);assert.equal(JSON.stringify(saved.room),room);assert.equal(JSON.stringify(saved.objects),roomObjects);assert.equal(saved.customDraft.objects.length,2)
undo();assert.equal(state.objects[1]!.height,600);redo();assert.equal(state.objects[1]!.height,800)
assert.equal(saveCustomObject('  Mesa  '),true);assert.equal(customEditing.value,false);assert.equal(state.projectName,mainName);assert.equal(JSON.stringify(state.room),room);assert.equal(JSON.stringify(state.objects),roomObjects);assert.equal(state.collisions,true)
assert.equal(state.customObjects[0]!.name,'Mesa');assert.equal(state.customObjects[0]!.object.type,'group');assert.equal(state.customObjects[0]!.object.children?.length,2)
const template=JSON.stringify(state.customObjects[0]!.object),assetId=state.customObjects[0]!.id
assert.equal(insertCustomObject(assetId),true);const first=state.objects.at(-1)!;assert.equal(first.name,'Mesa');assert.equal(first.collisions,true);assert.notEqual(first.id,state.customObjects[0]!.object.id);assert.notEqual(first.children![0]!.id,state.customObjects[0]!.object.children![0]!.id)
assert.equal(insertCustomObject(assetId),true);assert.notEqual(state.objects.at(-1)!.id,first.id);assert.equal(JSON.stringify(state.customObjects[0]!.object),template)
undo();undo();assert.equal(JSON.stringify(state.objects),roomObjects)
const exportJSON=projectJSON();await load(new File([exportJSON],'library.json'));assert.equal(state.error,'');assert.equal(state.customObjects[0]!.name,'Mesa')
const original=JSON.parse(exportJSON)
for(const customObjects of [false,[{...original.customObjects[0],name:''}],[{...original.customObjects[0],object:{...original.customObjects[0].object,width:NaN}}]]){await load(new File([JSON.stringify({...original,customObjects})],'invalid.json'));assert.ok(state.error);assert.equal(state.customObjects[0]!.name,'Mesa')}
await load(new File([exportJSON],'library.json'));beginCustomObject();add('cylinder');await nextTick();autosave.stop();cancelCustomObject();state.customObjects=[]
autosave=startAutosave(()=>storage);assert.equal(customEditing.value,true);assert.equal(state.room,null);assert.equal(state.objects[0]!.type,'cylinder');assert.equal(state.customObjects[0]!.name,'Mesa');cancelCustomObject();assert.equal(JSON.stringify(state.room),room);assert.equal(JSON.stringify(state.objects),roomObjects);autosave.stop()
beginCustomObject();add('box');assert.equal(saveCustomObject('Cubo'),true);assert.equal(state.customObjects[1]!.object.type,'box')
beginCustomObject();add('cylinder');edit('width','5000');assert.equal(saveCustomObject('Grande'),true);assert.equal(insertCustomObject(state.customObjects.at(-1)!.id),false);assert.ok(state.error);assert.equal(JSON.stringify(state.objects),roomObjects)
console.log('Custom objects: isolated workshop/history, overlaps, named templates, fresh IDs, insertion limits, JSON validation and draft/library autosave recovery passed.')

const count=state.customObjects.length,editingEntry=state.customObjects[0]!,editingId=editingEntry.id
assert.equal(insertCustomObject(editingId),true);const placedCopy=JSON.stringify(state.objects)
assert.equal(beginCustomObject(editingId),true);assert.equal(customEditingId.value,editingId);assert.equal(state.objects.length,2);assert.ok(state.objects.every(object=>object.collisions===false));edit('height','150');cancelCustomObject();assert.equal(state.customObjects[0]!.name,'Mesa');assert.equal(JSON.stringify(state.objects),placedCopy)
assert.equal(beginCustomObject(editingId),true);edit('height','150');assert.equal(saveCustomObject('Mesa editada'),true);assert.equal(state.customObjects.length,count);assert.equal(state.customObjects[0]!.id,editingId);assert.equal(state.customObjects[0]!.name,'Mesa editada');assert.equal(JSON.stringify(state.objects),placedCopy)
undo();assert.equal(state.customObjects[0]!.name,'Mesa');redo();assert.equal(state.customObjects[0]!.name,'Mesa editada')
values.clear();autosave=startAutosave(()=>storage);beginCustomObject(editingId);edit('height','200');await nextTick();assert.equal(JSON.parse(values.get(AUTOSAVE_KEY)!).customDraft.editingId,editingId);autosave.stop();cancelCustomObject()
autosave=startAutosave(()=>storage);assert.equal(customEditingId.value,editingId);assert.equal(saveCustomObject('Mesa recuperada'),true);assert.equal(state.customObjects.length,count);assert.equal(state.customObjects[0]!.id,editingId);assert.equal(state.customObjects[0]!.name,'Mesa recuperada');assert.equal(JSON.stringify(state.objects),placedCopy);autosave.stop()
console.log('Custom editing: pencil target, independent component editing, cancel, stable library ID, untouched room copies, undo/redo and editing-draft recovery passed.')
