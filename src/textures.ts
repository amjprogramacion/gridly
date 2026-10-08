export const MAX_TEXTURE_LENGTH=350000
export function validTexture(value:unknown):value is string{
 if(typeof value!=='string'||value.length>MAX_TEXTURE_LENGTH)return false
 return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}

// Embed a compact image so projects do not depend on a local file path.
export async function imageTexture(file:File):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Elige una imagen PNG, JPG o WebP.')
 if(file.size>10*1024*1024)throw Error('La imagen debe ocupar menos de 10 MB.')
 const image=await createImageBitmap(file)
 try{
  const scale=Math.min(1,512/Math.max(image.width,image.height)),canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale))
  const context=canvas.getContext('2d');if(!context)throw Error('No se pudo preparar la textura.')
  context.drawImage(image,0,0,canvas.width,canvas.height)
  for(const quality of [.85,.7,.5]){const value=canvas.toDataURL('image/webp',quality);if(validTexture(value))return value}
  throw Error('La imagen es demasiado compleja. Prueba con una imagen más pequeña.')
 }finally{image.close()}
}
