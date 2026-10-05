import { Vector3, type Object3D, type Camera } from 'three'
import type { Box } from './editor'

export function projectSelectionOutline(object:Box,mesh:Object3D,camera:Camera,width:number,height:number){
 const cx=object.width/2000,cz=object.depth/2000
 const bottom=object.type==='door'||object.type==='window'?0:-object.height/2000,top=bottom+object.height/1000
 mesh.updateWorldMatrix(true,false)
 const corners=[[-cx,bottom,-cz],[cx,bottom,-cz],[cx,bottom,cz],[-cx,bottom,cz],[-cx,top,-cz],[cx,top,-cz],[cx,top,cz],[-cx,top,cz]].map(([x,y,z])=>{
  const point=mesh.localToWorld(new Vector3(x,y,z)).project(camera)
  return {x:(point.x+1)*width/2,y:(1-point.y)*height/2}
 })
 const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
 return edges.map(([a,b])=>`M${corners[a!]!.x},${corners[a!]!.y}L${corners[b!]!.x},${corners[b!]!.y}`).join(' ')
}
