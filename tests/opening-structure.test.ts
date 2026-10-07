import assert from 'node:assert/strict'
import { defaultRoom, normalizeOpening, state, selected, checkpoint, undo, redo, moveSelected, resizeSelectedFromFace, dragOpeningToWall, type Box, type WallSide } from '../src/editor.ts'
import { intersectsObjects, hasObjectCollisions } from '../src/objectCollisions.ts'
import { limitMovement } from '../src/collisions.ts'
const room=defaultRoom(),visible={north:true,south:true,east:true,west:true}
for(const side of ['north','south','west','east'] as WallSide[])for(const type of ['door','window'] as const)for(const structural of ['column','beam'] as const){
 const horizontal=side==='north'||side==='south'
 const frame:Box={id:'frame',type,name:type,x:0,y:type==='door'?0:1000,z:0,width:600,height:type==='door'?2100:1000,depth:120,color:'#779b8e',collisions:false,wall:side,offset:(horizontal?room.width:room.depth)/2-1000}
 normalizeOpening(frame,room)
 const obstacle:Box={id:'structure',type:structural,name:structural,x:horizontal?0:(side==='west'?-1:1)*(room.width/2-150),y:structural==='beam'?1200:0,z:horizontal?(side==='north'?-1:1)*(room.depth/2-150):0,width:300,height:structural==='beam'?300:2500,depth:300,color:'#526171',collisions:false}
 const axis=horizontal?'x':'z',behind={...frame,[axis]:0}
 assert.equal(intersectsObjects(behind,[obstacle],room,false),true)
 assert.equal(intersectsObjects(obstacle,[behind],room,false),true)
 assert.equal(hasObjectCollisions([behind,obstacle],room,false),true)
 const result=limitMovement(frame,room,{...frame,[axis]:1000},[obstacle],false)
 assert.equal(result.blocked,true);assert.equal(result.position[axis],-450)
 state.room=room;state.objects=[{...frame},obstacle];state.selected=frame.id;state.snap=false;state.collisions=false
 checkpoint();moveSelected(horizontal?1000:frame.x,frame.y,horizontal?frame.z:1000)
 assert.equal(selected.value![axis],-450)
 undo();assert.equal(selected.value![axis],-1000);redo();assert.equal(selected.value![axis],-450)
 resizeSelectedFromFace({...selected.value!},'width',1200,1,horizontal?{x:1,y:0,z:0}:{x:0,y:0,z:1})
 assert.ok(selected.value!.width<600.001)
 // A wall switch cannot place a frame behind structure on its new wall.
 const otherSide=horizontal?'west':'north'
 const other={...frame,wall:otherSide as WallSide};normalizeOpening(other,room)
 state.objects=[other,obstacle];state.selected=other.id
 dragOpeningToWall(behind.x,behind.z,visible);assert.equal(selected.value!.wall,otherSide)
 const above={...behind,y:2000,height:300}
 if(structural==='beam')assert.equal(intersectsObjects(above,[obstacle],room,false),false)
}
console.log('Opening structure: wall contact on four walls, doors/windows, columns/beams, high-speed movement, resize, wall switching, vertical clearance and history passed.')
