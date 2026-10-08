import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { projectGroupTexture, sharedGroupTexture } from '../src/groupTexture.ts'
import { makeGroup } from '../src/groups.ts'
import type { Box } from '../src/editor.ts'
const piece:Box={id:'a',name:'a',type:'box',width:1000,height:1000,depth:1000,x:-500,y:0,z:0,color:'#ffffff',texture:'image'}
const object=makeGroup([piece,{...piece,id:'b',x:500}]);assert.equal(sharedGroupTexture(object),'image')
assert.equal(sharedGroupTexture(makeGroup([object,{...piece,id:'c',x:2000}])),'image')
object.children![1]!.texture='other';assert.equal(sharedGroupTexture(object),undefined)
const root=new Group(),nested=new Group();root.add(nested)
for(const x of [-.5,.5]){const mesh=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());mesh.position.x=x;nested.add(mesh)}
projectGroupTexture(root,{width:2,height:1,depth:1})
for(const mesh of nested.children as Mesh[]){const pos=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');for(let i=0;i<pos.count;i++){if(normal.getZ(i)===1){assert.ok(Math.abs(uv.getX(i)-((pos.getX(i)+mesh.position.x)/2+.5))<1e-6);assert.ok(Math.abs(uv.getY(i)-(pos.getY(i)+.5))<1e-6)}}}
console.log('Group texture: continuous projection across adjacent pieces, nested transforms and mixed images passed.')
