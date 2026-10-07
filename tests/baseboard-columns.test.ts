import assert from 'node:assert/strict'
import { defaultRoom, type Box } from '../src/editor.ts'
import { baseboardPieces } from '../src/walls.ts'
const room={...defaultRoom(),baseboard:true}
const column:Box={id:'column',type:'column',name:'Columna',x:0,y:0,z:-1550,width:400,height:2500,depth:400,color:'#526171'}
const trims=baseboardPieces(room,[column])
assert.ok(trims.some(p=>p.z===-1344&&p.width===400))
assert.ok(trims.some(p=>p.x===-206&&p.depth===400))
assert.ok(trims.some(p=>p.x===206&&p.depth===400))
assert.ok(!trims.some(p=>p.z===-1744&&Math.abs(p.x)<200))
for(const p of trims)assert.ok(!(p.x-p.width/2<200&&p.x+p.width/2>-200&&p.z-p.depth/2<-1350&&p.z+p.depth/2>-1750))
assert.equal(baseboardPieces(room,[{...column,z:0}]).length,4)
assert.equal(baseboardPieces(room,[{...column,y:100}]).length,4)
assert.deepEqual(baseboardPieces({...room,baseboard:false},[column]),[])
const corner=baseboardPieces(room,[{...column,x:-1800}])
assert.ok(corner.some(p=>p.x===-1594&&p.depth===400))
assert.ok(!corner.some(p=>p.x===-2006))
const joined=baseboardPieces(room,[column,{...column,id:'second',x:400}])
assert.ok(!joined.some(p=>p.x===194||p.x===206))
const overlapping=baseboardPieces(room,[column,{...column,id:'second',x:200,z:-1450}])
assert.ok(!overlapping.some(p=>p.x===206&&p.z>-1650&&p.z<-1350))
const door:Box={id:'door',name:'Puerta',type:'door',wall:'north',offset:3000,width:900,height:2100,depth:120,x:1000,y:0,z:-1810,color:'#b78b61'}
assert.ok(!baseboardPieces(room,[column,door]).some(p=>p.z===-1744&&p.x-p.width/2<1450&&p.x+p.width/2>550))
assert.equal(baseboardPieces({...room,walls:{...room.walls,north:false}},[column]).length,3)
console.log('Baseboard columns: exposed faces, wall cutouts, corners, detached/raised columns, connected columns, doors and disabled walls passed.')
