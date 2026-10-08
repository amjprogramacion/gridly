import { Matrix3, Mesh, Object3D, Vector3 } from 'three'
import type { Box } from './editor.ts'
// Matching leaf images share one projection in the outer group's local space.
export function sharedGroupTexture(object:Box):string|undefined{
 if(object.type!=='group')return object.texture
 const images=object.children?.map(sharedGroupTexture)??[]
 return images.length&&images[0]&&images.every(image=>image===images[0])?images[0]:undefined
}
export function projectGroupTexture(root:Object3D,size:{width:number;height:number;depth:number}){
 root.updateMatrixWorld(true)
 const point=new Vector3(),normal=new Vector3()
 root.traverse(node=>{
  if(!(node instanceof Mesh))return
  const positions=node.geometry.getAttribute('position'),normals=node.geometry.getAttribute('normal'),uv=node.geometry.getAttribute('uv')
  if(!positions||!normals||!uv)return
  const normalMatrix=new Matrix3().getNormalMatrix(node.matrixWorld)
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld)
   normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize()
   const x=point.x/size.width+.5,y=point.y/size.height+.5,z=point.z/size.depth+.5
   const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z)
   if(ay>=ax&&ay>=az)uv.setXY(i,x,normal.y>=0?1-z:z)
   else if(ax>=az)uv.setXY(i,normal.x>=0?1-z:z,y)
   else uv.setXY(i,normal.z>=0?x:1-x,y)
  }
  uv.needsUpdate=true
 })
}
