import type { Box, Room, WallSide } from './editor'
import { objectBounds } from './objectCollisions.ts'
import { groupChildren } from './groups.ts'
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

// Decorative skirting follows all enabled walls, with the same opening cutouts.
export const BASEBOARD_HEIGHT=80
export const BASEBOARD_DEPTH=12
export function baseboardPanels(room:Room,side:WallSide,objects:Box[]):WallPanel[]{
 if(!room.baseboard||!room.walls[side])return []
 const length=side==='north'||side==='south'?room.width:room.depth,height=Math.min(BASEBOARD_HEIGHT,room.height)
 return wallPanels(room,side,objects).flatMap(panel=>{
  const start=Math.max(0,panel.start),end=Math.min(length,panel.start+panel.width),top=Math.min(height,panel.bottom+panel.height)
  return end>start&&top>panel.bottom?[{start,bottom:panel.bottom,width:end-start,height:top-panel.bottom}]:[]
 })
}

export interface BaseboardPiece {x:number;y:number;z:number;width:number;height:number;depth:number}
export function baseboardPieces(room:Room,objects:Box[]):BaseboardPiece[]{
 if(!room.baseboard)return []
 const w=room.width/2,d=room.depth/2,t=Math.min(BASEBOARD_DEPTH,room.width/2,room.depth/2),h=Math.min(BASEBOARD_HEIGHT,room.height),pieces:BaseboardPiece[]=[]
 const flatten=(items:Box[]):Box[]=>items.flatMap(o=>o.type==='group'?flatten(groupChildren(o)):[o])
 const columns=flatten(objects).filter(o=>o.type==='column'&&o.y<1e-5).map(objectBounds).map(b=>({left:Math.max(-w,b.min.x),right:Math.min(w,b.max.x),back:Math.max(-d,b.min.z),front:Math.min(d,b.max.z)})).filter(b=>b.right>b.left&&b.front>b.back)
 const attached:typeof columns=[]
 let pending=[...columns],changed=true
 while(changed){changed=false;pending=pending.filter(b=>{
  const touches=room.walls.west&&b.left<=-w+1e-5||room.walls.east&&b.right>=w-1e-5||room.walls.north&&b.back<=-d+1e-5||room.walls.south&&b.front>=d-1e-5||attached.some(a=>b.left<=a.right+1e-5&&b.right>=a.left-1e-5&&b.back<=a.front+1e-5&&b.front>=a.back-1e-5)
  if(touches){attached.push(b);changed=true;return false}return true
 })}
 function subtract(start:number,end:number,cuts:number[][]){let spans=[[start,end]];for(const [a,b] of cuts)spans=spans.flatMap(([s,e])=>b!<=s!||a!>=e!?[[s!,e!]]:[[s!,Math.min(e!,a!)],[Math.max(s!,b!),e!]].filter(([l,r])=>r!>l!+1e-5));return spans}
 for(const side of ['north','south','west','east'] as WallSide[]){
  const horizontal=side==='north'||side==='south',length=horizontal?room.width:room.depth
  const cuts=attached.filter(b=>side==='north'?b.back<=-d+1e-5:side==='south'?b.front>=d-1e-5:side==='west'?b.left<=-w+1e-5:b.right>=w-1e-5).map(b=>horizontal?[b.left+length/2,b.right+length/2]:[b.back+length/2,b.front+length/2])
  for(const panel of baseboardPanels(room,side,objects))for(const [start,end] of subtract(panel.start,panel.start+panel.width,cuts)){
   const along=(start!+end!-length)/2
   pieces.push({x:horizontal?along:(side==='west'?-w+t/2:w-t/2),z:horizontal?(side==='north'?-d+t/2:d-t/2):along,y:panel.bottom+panel.height/2,width:horizontal?end!-start!:t,depth:horizontal?t:end!-start!,height:panel.height})
  }
 }
 for(const b of attached)for(const side of ['north','south','west','east'] as WallSide[]){
  const horizontal=side==='north'||side==='south',edge=side==='north'?b.back:side==='south'?b.front:side==='west'?b.left:b.right
  if(horizontal?(edge<=-d+1e-5||edge>=d-1e-5):(edge<=-w+1e-5||edge>=w-1e-5))continue
  const cuts=attached.filter(a=>a!==b&&(side==='north'?a.back<edge&&a.front>=edge-1e-5:side==='south'?a.front>edge&&a.back<=edge+1e-5:side==='west'?a.left<edge&&a.right>=edge-1e-5:a.right>edge&&a.left<=edge+1e-5)).map(a=>horizontal?[a.left,a.right]:[a.back,a.front])
  for(const [start,end] of subtract(horizontal?b.left:b.back,horizontal?b.right:b.front,cuts))pieces.push({x:horizontal?(start!+end!)/2:edge+(side==='west'?-t/2:t/2),z:horizontal?edge+(side==='north'?-t/2:t/2):(start!+end!)/2,y:h/2,width:horizontal?end!-start!:t,depth:horizontal?t:end!-start!,height:h})
 }
 // Fill exposed convex joins so the 12 mm strips meet without corner gaps.
 for(const b of attached)for(const [x,sx] of [[b.left,-1],[b.right,1]])for(const [z,sz] of [[b.back,-1],[b.front,1]]){
  const cx=x!+sx!*t/2,cz=z!+sz!*t/2
  const inside=(px:number,pz:number)=>attached.some(a=>a!==b&&px>a.left&&px<a.right&&pz>a.back&&pz<a.front)
  if(inside(x!+sx!*.001,z!-sz!*.001)||inside(x!-sx!*.001,z!+sz!*.001))continue
  if(cx-t/2<-w||cx+t/2>w||cz-t/2<-d||cz+t/2>d)continue
  if(attached.some(a=>a!==b&&cx+t/2>a.left+1e-5&&cx-t/2<a.right-1e-5&&cz+t/2>a.back+1e-5&&cz-t/2<a.front-1e-5))continue
  pieces.push({x:cx,y:h/2,z:cz,width:t,height:h,depth:t})
 }
 return pieces
}
