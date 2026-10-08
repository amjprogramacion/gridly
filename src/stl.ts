import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
export function validSTLMesh(value:unknown):value is number[]{return Array.isArray(value)&&value.length>=9&&value.length%9===0&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=.500001)}
export function stlGeometry(vertices:number[]){const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.setAttribute('uv',new Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));return geometry}
// STL has no unit metadata: use millimetres and convert the usual Z-up to Y-up.
export function parseSTL(buffer:ArrayBuffer){
 if(!buffer.byteLength)throw Error('El STL está vacío.')
 const count=buffer.byteLength>=84?new DataView(buffer).getUint32(80,true):0
 const binary=buffer.byteLength===84+count*50
 let expectedTriangles=count
 if(binary){if(!count)throw Error('El STL no contiene triángulos.')}
 else {const text=new TextDecoder().decode(buffer),facets=text.match(/facet\s+normal/gi)??[];expectedTriangles=facets.length;if(!/^\s*solid\b/i.test(text)||!facets.length||! /endsolid/i.test(text))throw Error('STL inválido.')}
 let geometry:BufferGeometry|undefined
 try{
  geometry=new STLLoader().parse(buffer);geometry.rotateX(-Math.PI/2)
  const positions=geometry.getAttribute('position')
  if(!positions||positions.count!==expectedTriangles*3||positions.count<3||positions.count%3)throw Error()
  if(Array.from(positions.array).some(n=>!Number.isFinite(n)))throw Error()
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!,size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3())
  if(Math.min(size.x,size.y,size.z)<.001||Math.max(size.x,size.y,size.z)>100000)throw Error('El STL debe tener volumen y medidas entre 0,001 y 100.000 mm.')
  const vertices:number[]=[]
  for(let i=0;i<positions.count;i++)vertices.push(Number(((positions.getX(i)-center.x)/size.x).toFixed(6)),Number(((positions.getY(i)-center.y)/size.y).toFixed(6)),Number(((positions.getZ(i)-center.z)/size.z).toFixed(6)))
  if(!validSTLMesh(vertices))throw Error()
  Object.freeze(vertices)
  return {vertices,width:size.x,height:size.y,depth:size.z}
 }catch(error){if(error instanceof Error&&error.message.startsWith('El STL'))throw error;throw Error('No se pudo leer el STL. Comprueba que sea un STL ASCII o binario válido.')}
 finally{geometry?.dispose()}
}
