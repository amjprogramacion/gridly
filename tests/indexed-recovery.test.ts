import assert from 'node:assert/strict'
import { startProjectPersistence } from '../src/projectPersistence.ts'
import { newLocalProject, type LocalProject } from '../src/localProjects.ts'
import { memoryRepository, memoryStorage, doc, port } from './helpers/projectFixtures.ts'
const db=memoryRepository(),storage=memoryStorage(),editor=port(doc('Inicial'))
const journals=new Map<string,LocalProject>()
let rejectRecovery=false
const recovery={
 list:async(account:string|null)=>[...journals].filter(([,p])=>p.accountId===account).map(([key,project])=>({key,project})),
 write:async(key:string,project:LocalProject)=>{if(rejectRecovery)throw Error('quota');journals.set(key,structuredClone(project))},
 remove:async(key:string,writeId:string)=>{if(journals.get(key)?.writeId===writeId)journals.delete(key)},
}
db.repository.recovery=recovery
const persistence=await startProjectPersistence(db.repository,storage,editor)
storage.setItem=()=>{throw Error('localStorage quota')}
editor.edit(doc('STL grande'));await persistence.flush();assert.equal(editor.warning(),'');assert.equal(journals.size,0);assert.equal((await db.repository.get(persistence.current().id))!.document,doc('STL grande'))
// A failed main write leaves the independent IndexedDB journal for restart.
db.fail(true);editor.edit(doc('Recuperar tras cierre'));await assert.rejects(persistence.flush());assert.equal(journals.size,1)
const foreign={...newLocalProject(doc('Cuenta privada')),accountId:'another-user'};journals.set('foreign',foreign)
db.fail(false);const restored=port(doc('Vacía'));const reload=await startProjectPersistence(db.repository,storage,restored)
assert.equal(restored.document(),doc('Recuperar tras cierre'));assert.equal(restored.warning(),'');assert.equal(journals.size,1);assert.ok(journals.has('foreign'))
// If both recovery stores fail, a successful main save still reports the limitation.
rejectRecovery=true;restored.edit(doc('Sin recuperación'));await reload.flush();assert.match(restored.warning(),/copia de recuperación/)
// Concurrent changes are serialized and no committed journal is left behind.
rejectRecovery=false;restored.edit(doc('Cambio 1'));const first=reload.flush();restored.edit(doc('Cambio 2'));const second=reload.flush();await Promise.all([first,second]);assert.equal(restored.warning(),'');assert.equal((await db.repository.get(reload.current().id))!.document,doc('Cambio 2'));assert.equal(journals.size,1)
console.log('IndexedDB recovery: localStorage quota fallback, crash replay, account isolation, real failures and queued changes passed.')
