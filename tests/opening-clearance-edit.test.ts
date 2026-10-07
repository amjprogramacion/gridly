import assert from 'node:assert/strict'
import { defaultRoom, normalizeOpening, state, editOpeningClearance, undo, redo, type Box, type WallSide } from '../src/editor.ts'
import { openingClearances } from '../src/openingClearances.ts'
for(const wall of ['north','south','east','west'] as WallSide[]){
 const room=defaultRoom(),horizontal=wall==='north'||wall==='south',axis=horizontal?'x':'z',normal=horizontal?'z':'x'
 const frame:Box={id:'w',name:'Ventana',type:'window',wall,offset:(horizontal?room.width:room.depth)/2,x:0,y:800,z:0,width:600,height:900,depth:120,color:'#fff'}
 normalizeOpening(frame,room);state.room=room;state.objects=[frame];state.selected=frame.id;state.snap=true
 const distances=()=>openingClearances(frame,room,state.objects)
 editOpeningClearance('left','123.5');assert.equal(distances()[0]!.value,123.5)
 undo();assert.equal(state.objects[0]![axis],0);redo();assert.equal(state.objects[0]![axis],123.5-(horizontal?room.width:room.depth)/2+300)
 // Undo replaces references; restore the fixture for further operations.
 state.objects=[frame]
 editOpeningClearance('right','321.25');assert.equal(distances()[1]!.value,321.25)
 editOpeningClearance('bottom','456.75');assert.equal(frame.y,456.75)
 editOpeningClearance('top','100');assert.equal(frame.y,1500)
 assert.equal(frame.width,600);assert.equal(frame.height,900);assert.equal(frame.wall,wall)
 for(const invalid of ['','-1','NaN','Infinity']){editOpeningClearance('left',invalid);assert.equal(distances()[1]!.value,321.25)}
 editOpeningClearance('bottom','9999');assert.equal(frame.y,1600)
 frame.type='door';normalizeOpening(frame,room);editOpeningClearance('bottom','100');editOpeningClearance('top','10');assert.equal(frame.y,0)
 frame.type='window';frame.offset=(horizontal?room.width:room.depth)/2-1000;frame.y=800;normalizeOpening(frame,room)
 const obstacle:Box={id:'c',name:'Columna',type:'column',x:0,y:0,z:0,width:300,depth:300,height:2500,color:'#fff',[normal]:(wall==='north'||wall==='west'?-1:1)*((horizontal?room.depth:room.width)/2-150)}
 state.objects=[frame,obstacle]
 editOpeningClearance('right','0');assert.equal(frame[axis],-450);assert.equal(distances()[1]!.value,0)
 // A request against the opposite wall cannot cross the column.
 editOpeningClearance('left',String((horizontal?room.width:room.depth)-600));assert.equal(frame[axis],-450)
 const beam={...obstacle,id:'b',type:'beam' as const,name:'Viga',y:2000,height:200,width:horizontal?1200:300,depth:horizontal?300:1200,[axis]:-1000}
 frame.offset=(horizontal?room.width:room.depth)/2-1000;frame.y=800;normalizeOpening(frame,room);state.objects=[frame,beam]
 editOpeningClearance('top','50');assert.equal(frame.y,1050);assert.equal(distances()[3]!.value,50)
 editOpeningClearance('bottom','1500');assert.equal(frame.y,1100);assert.equal(distances()[3]!.value,0)
}
console.log('Editable clearances: four walls, precise values, vertical moves, floor-bound doors, invalid input, collisions and history passed.')
