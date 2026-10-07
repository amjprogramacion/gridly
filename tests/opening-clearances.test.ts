import assert from 'node:assert/strict'
import { defaultRoom, normalizeOpening, type Box, type WallSide } from '../src/editor.ts'
import { makeGroup } from '../src/groups.ts'
import { openingClearances } from '../src/openingClearances.ts'
const room=defaultRoom()
for(const wall of ['north','south','east','west'] as WallSide[]){
 const horizontal=wall==='north'||wall==='south',axis=horizontal?'x':'z',normal=horizontal?'z':'x'
 const frame:Box={id:'w',name:'Ventana',type:'window',wall,offset:(horizontal?room.width:room.depth)/2,x:0,y:800,z:0,width:600,height:900,depth:120,color:'#fff'}
 normalizeOpening(frame,room)
 const base=openingClearances(frame,room,[])
 assert.deepEqual(base.map(c=>c.value),[(horizontal?room.width:room.depth)/2-300,(horizontal?room.width:room.depth)/2-300,800,800])
 const near=(wall==='north'||wall==='west'?-1:1)*((horizontal?room.depth:room.width)/2-100)
 const column:Box={id:'c',name:'Columna',type:'column',x:0,z:0,y:0,width:200,depth:200,height:2500,color:'#fff',[normal]:near,[axis]:-700}
 const beam:Box={...column,id:'b',name:'Viga',type:'beam',[axis]:0,y:2000,height:200,width:horizontal?1200:200,depth:horizontal?200:1200}
 const clear=openingClearances(frame,room,[column,beam])
 assert.deepEqual(openingClearances(frame,room,[makeGroup([makeGroup([column,beam])])]).map(c=>c.value),clear.map(c=>c.value))
 assert.equal(clear[0]!.value,300);assert.equal(clear[0]!.label,'Columna');assert.equal(clear[3]!.value,300);assert.equal(clear[3]!.label,'Viga')
 assert.deepEqual(openingClearances(frame,room,[{...column,[normal]:0}]).map(c=>c.value),base.map(c=>c.value))
 assert.equal(openingClearances({...frame,type:'door',y:0},room,[])[2]!.value,0)
 assert.equal(openingClearances(frame,room,[{...column,[axis]:-400}])[0]!.value,0)
 assert.equal(openingClearances(frame,room,[{...beam,y:300}])[2]!.value,300)
}
console.log('Opening clearance tests passed')
