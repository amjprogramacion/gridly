import assert from 'node:assert/strict'
import { fitRotation } from '../src/rotationFit.ts'
import { worldDimensions } from '../src/geometry.ts'
import { intersectsWall } from '../src/collisions.ts'
import { state, defaultRoom, add, beginRotation, endRotation, rotateSelected, undo, redo } from '../src/editor.ts'
state.collisions=false
import type { Box } from '../src/editor.ts'
const room=defaultRoom()
const beam:Box={id:'beam',type:'beam',name:'Viga',x:0,y:2250,z:0,width:4000,height:250,depth:300,color:'#96a4b5'}
for(let angle=-180;angle<=180;angle+=2){const fitted=fitRotation({...beam,rotationY:angle},room);assert.equal(fitted.rotationY,angle);assert.equal(intersectsWall(fitted,room),false,`Collision at ${angle}`);assert.equal(fitted.depth,300);assert.equal(fitted.height,250);assert.ok(fitted.width<=4000+1e-6)}
const perpendicular=fitRotation({...beam,rotationY:90},room);assert.ok(Math.abs(perpendicular.width-3500)<1e-6);assert.equal(perpendicular.depth,300)
const narrow=fitRotation({...beam,x:1800,rotationY:45},room);assert.equal(intersectsWall(narrow,room),false)
const tilted=fitRotation({...beam,x:1700,rotationX:45,rotationY:30,rotationZ:60},room);assert.equal(intersectsWall(tilted,room),false)
const tiny=fitRotation({...beam,width:1,height:1,depth:1,x:0,y:0,rotationY:45},{...room,width:1,depth:1});assert.equal(intersectsWall(tiny,{...room,width:1,depth:1}),false)
const disabled={...room,walls:{north:false,south:false,east:false,west:false}};assert.equal(fitRotation({...beam,rotationY:90},disabled).width,4000)
state.room=defaultRoom();state.objects=[];add('beam');beginRotation();rotateSelected({rotationY:90});assert.ok(Math.abs(state.objects[0]!.width-3500)<1e-6);rotateSelected({rotationY:0});assert.equal(state.objects[0]!.width,4000);rotateSelected({rotationY:90});endRotation();undo();assert.equal(state.objects[0]!.width,4000);assert.equal(state.objects[0]!.rotationY??0,0);redo();assert.ok(Math.abs(state.objects[0]!.width-3500)<1e-6);assert.equal(state.objects[0]!.rotationY,90)
console.log('Free rotation: all angles, maximum length, thickness preservation, XYZ tilt, narrow spaces, recovery and undo/redo passed.')
