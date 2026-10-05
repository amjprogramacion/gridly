import type { Box, Room, WallSide } from './editor'
export interface WallPanel {start:number;bottom:number;width:number;height:number}
// Split at each opening edge; retain cells outside the union of the openings.
export function wallPanels(room:Room,side:WallSide,objects:Box[]):WallPanel[]{
 const length=(side==='north'||side==='south'?room.width:room.depth),margin=(side==='north'||side==='south')?room.thickness:0
 const openings=objects.filter(o=>(o.type==='door'||o.type==='window')&&o.wall===side).map(o=>({left:Math.max(0,(o.offset??0)-o.width/2),right:Math.min(length,(o.offset??0)+o.width/2),bottom:o.y,top:Math.min(room.height,o.y+o.height)}))
 const xs=[...new Set([-margin,0,length,length+margin,...openings.flatMap(o=>[o.left,o.right])])].sort((a,b)=>a-b)
 const ys=[...new Set([0,room.height,...openings.flatMap(o=>[o.bottom,o.top])])].sort((a,b)=>a-b)
 const panels:WallPanel[]=[]
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const left=xs[i]!,right=xs[i+1]!,bottom=ys[j]!,top=ys[j+1]!,cx=(left+right)/2,cy=(bottom+top)/2;if(right<=left||top<=bottom||openings.some(o=>cx>o.left&&cx<o.right&&cy>o.bottom&&cy<o.top))continue;panels.push({start:left,bottom,width:right-left,height:top-bottom})}
 return panels
}

// Camera-only cutaway: keep corner fillers only while their adjoining wall is visible.
export function visibleWallSides(room:Room,camera:{x:number;z:number}):Record<WallSide,boolean>{
 const x=(room.width+room.thickness)/2,z=(room.depth+room.thickness)/2
 return {north:room.walls.north&&camera.z>=-z,south:room.walls.south&&camera.z<=z,west:room.walls.west&&camera.x>=-x,east:room.walls.east&&camera.x<=x}
}
export function wallPanelVisible(room:Room,side:WallSide,panel:WallPanel,visible:Record<WallSide,boolean>){
 if(!visible[side])return false
 if(side==='north'||side==='south'){
  if(panel.start<0)return visible.west
  if(panel.start>=room.width)return visible.east
 }
 return true
}
