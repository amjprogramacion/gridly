import assert from 'node:assert/strict'
import { parseSTL, validSTLMesh, stlGeometry } from '../src/stl.ts'
import { importSTL, state, selected, defaultRoom, undo, redo, projectJSON, parseProject, duplicate, edit, groupSelected, ungroupSelected, selectObject } from '../src/editor.ts'
const ascii="solid tetra\nfacet normal 0 0 -1\nouter loop\nvertex 0 0 0\nvertex 600 0 0\nvertex 0 400 0\nendloop\nendfacet\nfacet normal 0 -1 0\nouter loop\nvertex 0 0 0\nvertex 0 0 500\nvertex 600 0 0\nendloop\nendfacet\nfacet normal -1 0 0\nouter loop\nvertex 0 0 0\nvertex 0 400 0\nvertex 0 0 500\nendloop\nendfacet\nfacet normal 1 1 1\nouter loop\nvertex 600 0 0\nvertex 0 0 500\nvertex 0 400 0\nendloop\nendfacet\nendsolid tetra\n"
const buffer=new TextEncoder().encode(ascii).buffer
const mesh=parseSTL(buffer);assert.equal(mesh.width,600);assert.ok(Math.abs(mesh.height-500)<.001);assert.ok(Math.abs(mesh.depth-400)<.001);assert.equal(mesh.vertices.length,36);assert.equal(validSTLMesh(mesh.vertices),true)
const geometry=stlGeometry(mesh.vertices);assert.equal(geometry.getAttribute('normal').count,12);assert.equal(geometry.getAttribute('uv').count,12);geometry.dispose()
const binary=new ArrayBuffer(84+4*50),view=new DataView(binary);view.setUint32(80,4,true)
const original=[0,0,0,600,0,0,0,400,0,0,0,0,0,0,500,600,0,0,0,0,0,0,400,0,0,0,500,600,0,0,0,0,500,0,400,0]
for(let f=0;f<4;f++)for(let j=0;j<9;j++)view.setFloat32(84+f*50+12+j*4,original[f*9+j]!,true)
assert.deepEqual(parseSTL(binary).vertices,mesh.vertices)
for(const invalid of [new ArrayBuffer(0),new TextEncoder().encode('not an STL').buffer,new TextEncoder().encode(ascii.replaceAll('500','0')).buffer])assert.throws(()=>parseSTL(invalid))
assert.equal(validSTLMesh([NaN,...mesh.vertices.slice(1)]),false);assert.equal(validSTLMesh(Array(20001*9).fill(0)),true)
state.room=defaultRoom();state.objects=[];state.customObjects=[];state.selection=[];state.selected='';state.collisions=true
assert.equal(importSTL(buffer,'Mesa.stl'),true);assert.equal(selected.value!.name,'Mesa');assert.deepEqual(selected.value!.stl,mesh.vertices)
undo();assert.equal(state.objects.length,0);redo();assert.equal(state.objects.length,1)
assert.deepEqual(parseProject(projectJSON()).objects[0]!.stl,mesh.vertices)
duplicate();assert.equal(state.objects.length,2);assert.deepEqual(selected.value!.stl,mesh.vertices)
edit('color','#abcdef');assert.equal(selected.value!.color,'#abcdef');edit('width','300');assert.equal(selected.value!.width,300)
selectObject(state.objects[0]!.id,true);groupSelected();assert.equal(selected.value!.type,'group');ungroupSelected();assert.equal(state.objects.every(o=>!!o.stl),true)
const invalid=JSON.parse(projectJSON());invalid.objects[0].stl[0]=10;assert.throws(()=>parseProject(JSON.stringify(invalid)))
state.room={...defaultRoom(),width:100,depth:100,height:100};state.objects=[];assert.equal(importSTL(buffer,'large.stl'),false);assert.equal(state.objects.length,0)
console.log('STL: ASCII/binary, units, orientation, validation, placement, size, materials, groups, duplicates, history and JSON passed.')

// Exceeds both previous caps: 10 MB and 20,000 triangles.
const triangles=210000,large=new ArrayBuffer(84+triangles*50),largeView=new DataView(large);largeView.setUint32(80,triangles,true)
for(let f=0;f<triangles;f++)for(let j=0;j<9;j++)largeView.setFloat32(84+f*50+12+j*4,original[(f%4)*9+j]!,true)
const largeMesh=parseSTL(large);assert.equal(largeMesh.vertices.length,triangles*9);assert.equal(validSTLMesh(largeMesh.vertices),true)
const roundTrip=JSON.parse(JSON.stringify(largeMesh.vertices));assert.equal(validSTLMesh(roundTrip),true)
