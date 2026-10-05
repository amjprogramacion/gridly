import assert from 'node:assert/strict'
import { fitRotation } from '../src/rotationFit.ts'
import { worldDimensions } from '../src/geometry.ts'
import { intersectsWall, limitMovement } from '../src/collisions.ts'
import { snapPosition } from '../src/snapping.ts'
import { state, defaultRoom, add, edit, checkpoint, undo, redo, load } from '../src/editor.ts'
import type { Box } from '../src/editor.ts'
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`)
const object:Box={id:'rotation',type:'beam',name:'Viga',x:0,y:0,z:0,width:1200,height:200,depth:400,color:'#779b8e'}
let dimensions=worldDimensions({...object,rotationY:90});close(dimensions.width,400);close(dimensions.depth,1200);close(dimensions.height,200)
dimensions=worldDimensions({...object,rotationX:90});close(dimensions.height,400);close(dimensions.depth,200)
dimensions=worldDimensions({...object,rotationZ:90});close(dimensions.width,200);close(dimensions.height,1200)
dimensions=worldDimensions({...object,rotationY:45});close(dimensions.width,1600/Math.sqrt(2));close(dimensions.depth,1600/Math.sqrt(2))
const room=defaultRoom(),turned={...object,rotationY:90};assert.equal(intersectsWall({...turned,z:1300},room),true);assert.equal(intersectsWall({...turned,z:1150},room),false)
close(limitMovement(turned,room,{x:10000,y:0,z:0}).position.x,1800)
close(snapPosition(turned,room,[],{x:0,y:0,z:1120},{enabled:true,walls:true,step:50,axes:['z']}).position.z,1150)
assert.equal(intersectsWall(fitRotation({...object,rotationX:20,rotationY:45,rotationZ:10},room),room),false)
const long={...object,width:4000,depth:300},largeRoom={...room,depth:5000}
assert.equal(intersectsWall({...long,rotationY:90},largeRoom),false);assert.equal(intersectsWall(fitRotation({...long,rotationY:90},largeRoom),largeRoom),false) // Intermediate angles would cut through the wall.
assert.equal(intersectsWall(fitRotation({...object,x:1700,rotationY:90},room),room),false)
state.room=defaultRoom();state.objects=[];add('box');edit('width','1200');edit('depth','400');checkpoint();edit('rotationY','90',false);close(state.objects[0]!.rotationY!,90);undo();assert.equal(state.objects[0]!.rotationY??0,0);redo();close(state.objects[0]!.rotationY!,90)
edit('rotationX','20');assert.equal(state.objects[0]!.rotationX,20)
edit('z','1100');const oldWidth=state.objects[0]!.width;edit('width','4000');assert.equal(state.objects[0]!.width,oldWidth)
const saved={version:4,units:'mm',room:defaultRoom(),objects:[{...object,rotationX:15,rotationY:30,rotationZ:5}]}
await load(new File([JSON.stringify(saved)],'rotation.json'));assert.equal(state.error,'');assert.equal(state.objects[0]!.rotationY,30)
await load(new File([JSON.stringify({...saved,version:3,objects:[object]})],'old.json'));assert.equal(state.error,'');assert.equal(state.objects[0]!.rotationY??0,0)
const previous=JSON.stringify(state.objects);await load(new File([JSON.stringify({...saved,objects:[{...object,rotationY:null}]})],'invalid.json'));assert.ok(state.error);assert.equal(JSON.stringify(state.objects),previous)
console.log('Rotation: XYZ dimensions, automatic rotation fitting, rotated movement/snap, numeric edits, history and project migration passed.')
