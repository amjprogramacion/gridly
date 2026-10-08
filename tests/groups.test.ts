import assert from 'node:assert/strict'
import { state, selected, selectObject, selection, groupSelected, ungroupSelected, moveSelected, edit, duplicate, remove, undo, redo, projectJSON, load, defaultRoom, resizeSelectedFromFace, editStructuralColor, startAutosave, AUTOSAVE_KEY } from '../src/editor.ts'
import { groupChildren, validateGroups, makeGroup } from '../src/groups.ts'
import { objectBounds, intersectsObjects } from '../src/objectCollisions.ts'
import { limitMovement } from '../src/collisions.ts'
import type { Box } from '../src/editor.ts'
const piece=(id:string,x:number):Box=>({id,name:id,type:'box',x,y:0,z:0,width:400,height:400,depth:400,color:'#779b8e',collisions:true})
function setup(){state.room=defaultRoom();state.snap=false;state.collisions=true;state.objects=[piece('a',-300),piece('b',300)];selectObject('a');selectObject('b',true)}
setup();assert.equal(selection.value.length,2)
groupSelected();assert.equal(state.objects.length,1);assert.equal(selected.value!.type,'group');assert.equal(selected.value!.width,1000)
const groupId=selected.value!.id
moveSelected(500,100,0);assert.deepEqual(groupChildren(selected.value!).map(o=>[o.x,o.y]),[[200,100],[800,100]])
edit('rotationY','90');const children=groupChildren(selected.value!);assert.ok(Math.abs(children[0]!.z-300)<1e-6);assert.ok(Math.abs(children[1]!.z+300)<1e-6)
edit('width','1500');assert.equal(selected.value!.height,600);assert.equal(groupChildren(selected.value!)[0]!.width,600)
const before=groupChildren(selected.value!)
ungroupSelected();assert.equal(state.objects.length,2);for(let i=0;i<2;i++)assert.deepEqual(state.objects[i],before[i])
undo();assert.equal(selected.value!.id,groupId);redo();assert.equal(state.objects.length,2)
setup();groupSelected();duplicate();assert.equal(state.objects.length,2)
const ids=validateGroups(state.objects).map(o=>o.id);assert.equal(new Set(ids).size,ids.length)
remove();assert.equal(state.objects.length,1);undo();assert.equal(state.objects.length,2)
setup();groupSelected();moveSelected(0,100,0);const original={...selected.value!},bounds=objectBounds(original)
resizeSelectedFromFace(original,'width',1200,1,{x:1,y:0,z:0})
assert.equal(selected.value!.height,480);assert.equal(objectBounds(selected.value!).min.x,bounds.min.x)
assert.ok(Math.abs((objectBounds(selected.value!).min.y+objectBounds(selected.value!).max.y)/2-300)<1e-6)
moveSelected(100000,0,0);assert.equal(objectBounds(selected.value!).max.x,2000)
edit('rotationY','30');assert.equal(selected.value!.rotationY??0,0) // Rigid rotation cannot cross the wall.
const json=projectJSON();await load({text:async()=>json} as File);assert.equal(state.error,'');assert.equal(state.objects[0]!.type,'group')
const invalid=JSON.parse(json);invalid.objects[0].children[1].id=invalid.objects[0].children[0].id
await load({text:async()=>JSON.stringify(invalid)} as File);assert.ok(state.error);assert.equal(projectJSON(),json)
const storage={getItem:()=>json,setItem:(_key:string,_value:string)=>{}}
const autosave=startAutosave(()=>storage);assert.equal(state.objects[0]!.type,'group');autosave.stop();assert.equal(AUTOSAVE_KEY,'gridly.autosave')
setup();state.objects[0]!.type='column';state.objects[0]!.color=state.structuralColor;groupSelected();editStructuralColor('#abcdef');assert.equal(selected.value!.children![0]!.color,'#abcdef')
ungroupSelected();assert.equal(state.objects[0]!.color,'#abcdef')
setup();groupSelected();const first=selected.value!.id;state.objects.push(piece('c',1200));selectObject('c',true);groupSelected();assert.equal(selected.value!.children![0]!.id,first)
const nested=projectJSON();await load({text:async()=>nested} as File);assert.equal(state.error,'');selectObject(state.objects[0]!.id);ungroupSelected();assert.equal(state.objects[0]!.type,'group')
setup();state.objects[1]!.type='door';groupSelected();assert.equal(state.objects.length,2)
setup();state.objects[0]!.x=-200;state.objects[1]!.x=200;groupSelected();moveSelected(0,500,0);edit('rotationX','15');edit('rotationY','30');edit('rotationZ','10');ungroupSelected()
assert.equal(state.objects.length,2) // Touching rotated components must separate without false overlap.
const touchingJSON=projectJSON();await load({text:async()=>touchingJSON} as File);assert.equal(state.error,'')
const a=state.objects[0]!,b=state.objects[1]!
const crossing=limitMovement(a,null,{x:a.x+10*(b.x-a.x),y:a.y+10*(b.y-a.y),z:a.z+10*(b.z-a.z)},[b],true)
assert.equal(crossing.blocked,true);assert.ok(Math.abs(crossing.position.x-a.x)<1e-5)
console.log('Groups: selection, rigid transforms, proportional face resize, collisions, nested groups, unique duplication, history, JSON validation, autosave and structural color passed.')


// An external piece may occupy empty space between grouped components.
setup();state.error='';state.objects.push({...piece('middle',0),width:100,height:100,depth:100});
groupSelected();assert.equal(state.error,'');assert.equal(state.objects.length,2);
const hollow=selected.value!;assert.equal(hollow.type,'group');
const saved=projectJSON();await load({text:async()=>saved} as File);assert.equal(state.error,'');selectObject(hollow.id);
moveSelected(0,0,1000);assert.equal(selected.value!.z,1000);undo();assert.equal(selected.value!.z,0);
moveSelected(1000,0,0);assert.equal(state.collisionBlocked,true);assert.ok(selected.value!.x<1000);
undo();ungroupSelected();assert.equal(state.objects.length,3);assert.equal(state.error,'');
// Real intersections remain blocked when grouping.
setup();state.error='';state.objects.push({...piece('crossing',-300),width:100});groupSelected();assert.equal(state.objects.length,3);assert.ok(state.error);

// A tabletop near the wall and its inset leg do not fill the space above skirting.
state.room={...defaultRoom(),baseboard:true};state.error='';state.objects=[{...piece('top',0),y:700,z:-1600,width:1000,height:30,depth:300},{...piece('leg',0),z:-1450,width:50,height:700,depth:50}];selectObject('top');selectObject('leg',true);
groupSelected();assert.equal(state.error,'');assert.equal(state.objects.length,1);
const table=selected.value!;assert.equal(intersectsObjects(table,state.objects,state.room,true),false);
const nestedTable=makeGroup([table,{...piece('extra',1000),z:500}]);
assert.equal(intersectsObjects(nestedTable,[nestedTable],state.room,true),false);
const obstacle=makeGroup([{...piece('obstacle',0),z:-1450,y:200,width:20,height:20,depth:20}]);
assert.equal(intersectsObjects(nestedTable,[obstacle],state.room,true),true);
