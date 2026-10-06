<script setup lang="ts">
import { computed } from 'vue'
import { BoxGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, Vector3, Color, MathUtils } from 'three'
import { groupChildren } from './groups'
import { worldDimensions } from './geometry'
import type { Box } from './editor'
const props=defineProps<{object:Box}>()
const faces=computed(()=>{
 const faces:{points:{x:number;y:number}[];depth:number;color:string}[]=[]
 const eye=new Vector3(1,1,1).normalize(),light=new Vector3(.4,1,.7).normalize()
 function visit(object:Box){
  if(object.children){groupChildren(object).forEach(visit);return}
  const geometry=object.type==='cylinder'?new CylinderGeometry(.5,.5,1,32):new BoxGeometry(1,1,1)
  const q=new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(object.rotationX??0),MathUtils.degToRad(object.rotationY??0),MathUtils.degToRad(object.rotationZ??0),'XYZ'))
  const matrix=new Matrix4().compose(new Vector3(object.x,object.y+worldDimensions(object).height/2,object.z),q,new Vector3(object.width,object.height,object.depth))
  const positions=geometry.getAttribute('position'),indices=geometry.index!
  for(let i=0;i<indices.count;i+=3){
   const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,indices.getX(i+j)).applyMatrix4(matrix))
   const normal=new Vector3().subVectors(points[1]!,points[0]!).cross(new Vector3().subVectors(points[2]!,points[0]!)).normalize()
   if(normal.dot(eye)<=0)continue
   const color=new Color(object.color).multiplyScalar(.55+.45*Math.max(0,normal.dot(light))).getStyle()
   faces.push({points:points.map(p=>({x:(p.x-p.z)*.7071,y:(p.x+p.z)*.4082-p.y*.8165})),depth:points.reduce((sum,p)=>sum+p.dot(eye),0)/3,color})
  }
  geometry.dispose()
 }
 visit(props.object)
 if(!faces.length)return []
 const points=faces.flatMap(face=>face.points),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y))
 const scale=Math.min(160/Math.max(1,maxX-minX),110/Math.max(1,maxY-minY))
 return faces.sort((a,b)=>a.depth-b.depth).map(face=>({color:face.color,points:face.points.map(p=>`${100+(p.x-(minX+maxX)/2)*scale},${75+(p.y-(minY+maxY)/2)*scale}`).join(' ')}))
})
</script>
<template><svg class="custom-thumbnail" viewBox="0 0 200 150" role="img" :aria-label="object.name"><polygon v-for="(face,index) in faces" :key="index" :points="face.points" :fill="face.color" :stroke="face.color" stroke-width=".4" stroke-linejoin="round"/></svg></template>
