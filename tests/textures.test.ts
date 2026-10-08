import assert from 'node:assert/strict'
import { state, selected, setObjectTexture, undo, redo, projectJSON, parseProject, restoreProject, duplicate, edit, groupSelected, ungroupSelected, type Box } from '../src/editor.ts'
import { MAX_TEXTURE_LENGTH, validTexture } from '../src/textures.ts'
import { makeGroup, cloneObject } from '../src/groups.ts'
import { canEditAppearance, hasTexture } from '../src/editor.ts'
const texture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
const box:Box={id:'box',type:'box',name:'Prisma',x:0,y:0,z:0,width:600,height:600,depth:600,color:'#779b8e',collisions:false}
state.room=null;state.objects=[{...box}];state.selected=box.id;state.selection=[];state.customObjects=[];state.collisions=false
assert.equal(setObjectTexture(box.id,texture),true)
assert.equal(selected.value!.texture,texture)
undo();assert.equal(selected.value!.texture,undefined)
redo();assert.equal(selected.value!.texture,texture)
assert.equal(parseProject(projectJSON()).objects[0]!.texture,texture)
restoreProject(projectJSON());state.selected=box.id
duplicate();assert.equal(selected.value!.texture,texture)
assert.notEqual(selected.value!.id,box.id)
state.selection=state.objects.map(o=>o.id);groupSelected()
const group=selected.value!;assert.equal(group.children!.every(o=>o.texture===texture),true)
assert.equal(parseProject(projectJSON()).objects[0]!.children![0]!.texture,texture)
ungroupSelected();assert.equal(state.objects.every(o=>o.texture===texture),true)
edit('color','#ffffff');assert.equal(selected.value!.texture,undefined)
undo();assert.equal(selected.value!.texture,texture)
setObjectTexture(selected.value!.id);assert.equal(selected.value!.texture,undefined)
undo();assert.equal(selected.value!.texture,texture)
const historyTexture=selected.value!.texture
for(const invalid of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,?','x'.repeat(MAX_TEXTURE_LENGTH+1)]){
 assert.equal(validTexture(invalid),false)
 assert.equal(setObjectTexture(selected.value!.id,invalid),false)
 assert.equal(selected.value!.texture,historyTexture)
 const document=JSON.parse(projectJSON());document.objects[0].texture=invalid
 assert.throws(()=>parseProject(JSON.stringify(document)))
}
state.objects=[{...box,type:'cylinder'}];state.selected=box.id
assert.equal(setObjectTexture(box.id,texture),true)
assert.equal(parseProject(projectJSON()).objects[0]!.texture,texture)
for(const type of ['column','beam','door','window'] as const){state.objects=[{...box,type}];assert.equal(setObjectTexture(box.id,texture),false)}
for(const version of [1,2,3,4,5,6])assert.equal(parseProject(JSON.stringify({version,units:'mm',room:null,objects:[box]})).objects[0]!.texture,undefined)
const inner=makeGroup([{...box,id:'a',color:'#ff0000'},{...box,id:'b',type:'cylinder',x:600,color:'#0000ff'}])
inner.atomic=true
const compound=makeGroup([inner,{...box,id:'c',x:1500}]);compound.atomic=true
const template=cloneObject(compound)
state.objects=[compound];state.selected=compound.id;state.selection=[]
assert.equal(canEditAppearance(compound),true)
assert.equal(setObjectTexture(compound.id,texture),true)
assert.equal(hasTexture(selected.value!),true)
assert.equal(selected.value!.children![0]!.children!.every(piece=>piece.texture===texture),true)
assert.equal(selected.value!.children![1]!.texture,texture)
assert.equal(selected.value!.texture,undefined)
assert.equal(hasTexture(template),false)
assert.equal(hasTexture(parseProject(projectJSON()).objects[0]!),true)
setObjectTexture(compound.id);assert.equal(hasTexture(selected.value!),false)
undo();assert.equal(hasTexture(selected.value!),true)
edit('color','#ffff00');assert.equal(hasTexture(selected.value!),false)
assert.equal(selected.value!.children![0]!.children!.every(piece=>piece.color==='#ffff00'),true)
assert.equal(template.children![0]!.children![0]!.color,'#ff0000')
undo();assert.equal(hasTexture(selected.value!),true)
redo();assert.equal(hasTexture(selected.value!),false)
assert.equal(selected.value!.atomic,true)
const structural=makeGroup([{...box,type:'column'}]);assert.equal(canEditAppearance(structural),false)
console.log('Textures: assignment/removal, colour replacement, history, JSON, duplicates, groups, cylinders, invalid inputs and legacy projects passed.')
