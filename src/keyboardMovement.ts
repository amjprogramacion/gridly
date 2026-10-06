export function cameraArrowDirection(key:string,right:{x:number;z:number}){
 const length=Math.hypot(right.x,right.z)
 if(length<1e-8)return null
 // Choose the world axis closest to screen-right; the other axis is screen-up.
 const x=Math.abs(right.x)>=Math.abs(right.z)?Math.sign(right.x):0
 const z=x===0?Math.sign(right.z):0
 switch(key){
  case 'ArrowRight':return {x,z}
  case 'ArrowLeft':return {x:-x,z:-z}
  case 'ArrowUp':return {x:z,z:-x}
  case 'ArrowDown':return {x:-z,z:x}
  default:return null
 }
}
