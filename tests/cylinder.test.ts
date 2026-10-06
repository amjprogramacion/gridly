import assert from 'node:assert/strict'
import { state, defaultRoom, add, edit, duplicate, undo, redo, load, projectJSON, selectObject, groupSelected, ungroupSelected } from '../src/editor.ts'
state.room=defaultRoom();state.objects=[];state.collisions=true;state.snap=false;state.wallSnap=false
add('cylinder');assert.equal(state.objects[0]?.type,'cylinder');assert.equal(state.objects[0]?.name,'Cilindro 1')
edit('width','800');edit('height','900');edit('depth','400');assert.deepEqual([state.objects[0]?.width,state.objects[0]?.height,state.objects[0]?.depth],[800,900,400])
edit('y','2000');assert.ok(state.objects[0]!.y+state.objects[0]!.height<=2500)
duplicate();assert.equal(state.objects.length,2);assert.equal(state.objects[1]?.type,'cylinder');undo();assert.equal(state.objects.length,1);redo();assert.equal(state.objects.length,2)
const ids=state.objects.map(object=>object.id);selectObject(ids[0]!);selectObject(ids[1]!,true);groupSelected();assert.equal(state.objects.length,1);assert.equal(state.objects[0]?.type,'group')
const json=projectJSON();await load(new File([json],'cylinders.json'));assert.equal(state.error,'');assert.equal(state.objects[0]?.children?.[0]?.type,'cylinder')
selectObject(state.objects[0]!.id);ungroupSelected();assert.equal(state.objects.length,2);assert.ok(state.objects.every(object=>object.type==='cylinder'))
console.log('Cylinders: dimensions, ceiling, duplicate, history, grouping and JSON round-trip passed.')
