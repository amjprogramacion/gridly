import type { Box, Room } from './editor'
import { worldDimensions } from './geometry.ts'
import { fitRoomObject } from './collisions.ts'
export function fitRotation(object:Box,room:Room|null){
 const fitted={...object};if(!room)return fitted
 const limitX=Math.min(room.walls.west?2*(object.x+room.width/2):Infinity,room.walls.east?2*(room.width/2-object.x):Infinity)
 const limitZ=Math.min(room.walls.north?2*(object.z+room.depth/2):Infinity,room.walls.south?2*(room.depth/2-object.z):Infinity)
 const limitY=Math.max(0,room.height-object.y)
 const minimum=0.001
 const keys=['width','depth','height'] as const
 const coefficients=keys.map(key=>{const unit={...object,width:0,height:0,depth:0,[key]:1};const bounds=worldDimensions(unit);return {key,x:bounds.width,y:bounds.height,z:bounds.depth}})
 // Preserve thickness/height when possible. Reduce the dominant width/depth contribution first, including at the ceiling.
 for(let iteration=0;iteration<12;iteration++){
  const bounds=worldDimensions(fitted),constraints=[{axis:'x' as const,extent:bounds.width,limit:limitX},{axis:'z' as const,extent:bounds.depth,limit:limitZ},{axis:'y' as const,extent:bounds.height,limit:limitY}]
  const violated=constraints.filter(c=>c.extent>c.limit+1e-7).sort((a,b)=>(b.extent-b.limit)-(a.extent-a.limit))[0]
  if(!violated)break
  const eligible=coefficients.filter(c=>c[violated.axis]>1e-12&&fitted[c.key]>minimum+1e-7)
  const horizontal=eligible.filter(c=>c.key!=='height'),choice=(horizontal.length?horizontal:eligible).sort((a,b)=>b[violated.axis]*(fitted[b.key]-minimum)-a[violated.axis]*(fitted[a.key]-minimum))[0]
  if(!choice)break
  fitted[choice.key]=Math.max(minimum,fitted[choice.key]-(violated.extent-violated.limit)/choice[violated.axis])
 }
 // Only necessary when the centre leaves less room than even the minimum piece.
 for(const key of keys)fitted[key]=Math.floor(fitted[key]*1000+1e-6)/1000
 fitRoomObject(fitted,room)
 return fitted
}

