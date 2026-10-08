import assert from 'node:assert/strict'
import { nextTick, reactive } from 'vue'
import { geometrySignature } from '../src/geometrySignature.ts'
import { cloneObject, groupChildren, makeGroup } from '../src/groups.ts'
import { state, objectInteraction, startAutosave, moveSelected, undo, redo, checkpoint, type Box } from '../src/editor.ts'
const vertices=Array(210000*9).fill(0);Object.freeze(vertices)
const object:Box={id:'large',name:'large',type:'box',x:0,y:0,z:0,width:600,height:500,depth:400,color:'#ffffff',stl:vertices,collisions:false}
const model=reactive(object),signature=geometrySignature(model);assert.ok(signature.length<300)
assert.equal(cloneObject(model).stl,vertices)
const group=makeGroup([object,{...object,id:'other',x:600}]);assert.equal(groupChildren(group)[0]!.stl,vertices)
model.x=1;assert.notEqual(geometrySignature(model),signature)
assert.notEqual(geometrySignature({...model,stl:Object.freeze([...vertices])}),geometrySignature(model))
state.room=null;state.objects=[object];state.selected=object.id;state.selection=[];state.customObjects=[];state.collisions=false
let writes=0,last='';const persistence=startAutosave(()=>({getItem:()=>null,setItem:(_key,value)=>{writes++;last=value}}))
checkpoint();objectInteraction.value=true;await nextTick()
for(let i=1;i<=20;i++){moveSelected(i*50,0,0);await nextTick()}
assert.equal(writes,0)
objectInteraction.value=false;await nextTick();assert.equal(writes,1);assert.equal(JSON.parse(last).objects[0].x,1000)
undo();assert.equal(Object.isFrozen(state.objects[0]!.stl),true);redo();assert.equal(Object.isFrozen(state.objects[0]!.stl),true)
objectInteraction.value=true;moveSelected(1500,0,0);persistence.flush();assert.equal(JSON.parse(last).objects[0].x,1500);objectInteraction.value=false;persistence.stop()
const start=performance.now();for(let i=0;i<100;i++)geometrySignature(model);const compact=performance.now()-start
const fullStart=performance.now();JSON.stringify(model);const full=performance.now()-fullStart
console.log('Large STL: shared immutable geometry, compact signatures, one save per gesture, explicit flush, history passed. 100 compact signatures: '+compact.toFixed(1)+' ms; one full JSON: '+full.toFixed(1)+' ms.')
