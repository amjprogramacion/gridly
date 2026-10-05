// Hysteresis ignores imperceptible damping while avoiding repeated show/hide cycles.
export function createCameraMotion(){
 let hidden=false,quietFrames=0
 return (interacting:boolean,pixels:number)=>{
  if(interacting||pixels>.5){hidden=true;quietFrames=0}
  else if(hidden){
   if(pixels<=.25){if(++quietFrames>=2)hidden=false}
   else quietFrames=0
  }
  return hidden
 }
}
