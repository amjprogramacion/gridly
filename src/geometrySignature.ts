import { toRaw } from 'vue'
const identities=new WeakMap<object,number>();let next=0
// Geometry is immutable: observe its identity, not millions of coordinates.
export function geometrySignature(value:unknown){return JSON.stringify(value,(key,item)=>{if(key!=='stl'||!Array.isArray(item))return item;const raw=toRaw(item);let id=identities.get(raw);if(id===undefined){id=++next;identities.set(raw,id)}return {geometry:id}})}
