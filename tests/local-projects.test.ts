import assert from 'node:assert/strict'
import { cloudDocument, editLocalProject, newLocalProject, resolveLocalWrite, type LocalProject, type ProjectRepository } from '../src/localProjects.ts'
import { startProjectPersistence, startRecoveryPersistence, LEGACY_AUTOSAVE_KEY, RECOVERY_PREFIX } from '../src/projectPersistence.ts'
import { projectJSON, parseProject, restoreProject, state, defaultRoom, beginCustomObject, cancelCustomObject, add } from '../src/editor.ts'

import { memoryRepository, memoryStorage, doc, port } from './helpers/projectFixtures.ts'

// Migration preserves the original source and creates a stable project identity.
const store = memoryStorage(), db = memoryRepository(), first = port(doc('Nueva'))
store.setItem(LEGACY_AUTOSAVE_KEY, doc('Anterior'))
const persistence = await startProjectPersistence(db.repository, store, first)
assert.equal(first.document(), doc('Anterior'))
const id = persistence.current().id
assert.equal(store.getItem(LEGACY_AUTOSAVE_KEY), doc('Anterior'))
assert.equal(persistence.current().baseRevision, null)
assert.equal(persistence.current().pending, true)
first.edit(doc('Modificada')); await persistence.flush()
assert.equal((await db.repository.get(id))!.document, doc('Modificada'))
assert.equal(store.values.size, 1) // Only untouched migration source remains.
const reloadPort = port(doc('Vacía'))
const reload = await startProjectPersistence(db.repository, store, reloadPort)
assert.equal(reload.current().id, id); assert.equal(reloadPort.document(), doc('Modificada'))

// Import creates a separate record; open restores the selected project.
const importedId = await reload.create(doc('Importada'))
assert.notEqual(importedId, id)
assert.equal((await reload.list()).length, 2)
await reload.open(id); assert.equal(reloadPort.document(), doc('Modificada'))
await assert.rejects(() => reload.create('{}'))
assert.equal(reload.current().id, id)

// Two stale tabs preserve both versions rather than replacing the first save.
first.edit(doc('Pestaña A')); await persistence.flush()
const beforeStaleFlush = db.projects.size
await reload.flush()
assert.equal(db.projects.size, beforeStaleFlush) // An unchanged stale tab must not create a conflict copy.
reloadPort.edit(doc('Pestaña B')); await reload.flush()
assert.equal((await db.repository.get(id))!.document, doc('Pestaña A'))
assert.notEqual(reload.current().id, id)
assert.equal(reload.current().recoveredFrom, id)
assert.equal((await db.repository.get(reload.current().id))!.document, doc('Pestaña B'))
assert.match(reloadPort.warning(), /Otra pestaña/)

// Queued writes preserve newer edits while an earlier transaction is pending.
let release!: () => void
const barrier = new Promise<void>(resolve => { release = resolve })
db.delay(() => barrier)
reloadPort.edit(doc('Cambio 1')); const one = reload.flush()
reloadPort.edit(doc('Cambio 2')); const two = reload.flush()
release(); await Promise.all([one, two]); db.delay()
assert.equal(reload.current().document, doc('Cambio 2'))
assert.equal((await db.repository.get(reload.current().id))!.document, doc('Cambio 2'))

// Failed IndexedDB writes leave the latest journal, which a new session recovers.
db.fail(true); reloadPort.edit(doc('Pendiente al cerrar'))
await assert.rejects(() => reload.flush())
assert.ok([...store.values.keys()].some(key => key.startsWith(RECOVERY_PREFIX)))
await assert.rejects(() => reload.create(doc('No perder la anterior')))
assert.equal(reload.current().document, doc('Pendiente al cerrar'))
db.fail(false)
const recoveredPort = port(doc('Vacía'))
const recovered = await startProjectPersistence(db.repository, store, recoveredPort)
assert.equal(recoveredPort.document(), doc('Pendiente al cerrar'))
assert.equal([...store.values.keys()].filter(key => key.startsWith(RECOVERY_PREFIX)).length, 0)

// Replaying a committed write and a committed fork is idempotent.
const record = recovered.current()
assert.deepEqual(await db.repository.write(record), record)
const stale = editLocalProject({ ...record, localVersion: 0 }, doc('Rescate'))
store.setItem(RECOVERY_PREFIX + 'crash', JSON.stringify(stale))
const fork = await db.repository.write(stale)
const count = db.projects.size
await startProjectPersistence(db.repository, store, port(doc('Vacía')))
assert.equal(db.projects.size, count); assert.equal((await db.repository.get(fork.id))!.document, doc('Rescate'))

// Drafts are local; only saving the template changes the cloud document.
state.room=defaultRoom(); state.objects=[]; state.customObjects=[]; state.collisions=false
const synced = cloudDocument(projectJSON())
const syncedRecord = { ...newLocalProject(projectJSON()), syncedDocument: synced, baseRevision: 7, pending: false }
assert.ok(beginCustomObject()); add()
const withDraft = editLocalProject(syncedRecord, projectJSON())
assert.equal(withDraft.pending, false); assert.equal(withDraft.baseRevision, 7)
assert.ok(JSON.parse(withDraft.document).customDraft)
restoreProject(withDraft.document); assert.equal(projectJSON(), withDraft.document)
cancelCustomObject()

// Accounts are scoped; anonymous recovery leaves another account's journal alone.
const foreign = { ...newLocalProject(doc('Privada')), accountId: 'another-user' }
await db.repository.write(foreign)
store.setItem(RECOVERY_PREFIX + 'foreign', JSON.stringify(foreign))
const anonymous = await startProjectPersistence(db.repository, store, port(doc('Vacía')))
assert.equal(anonymous.current().accountId, null)
assert.ok((await anonymous.list()).every(p => p.accountId === null))
await assert.rejects(() => anonymous.open(foreign.id))
assert.ok(store.getItem(RECOVERY_PREFIX + 'foreign'))

// Invalid sources survive without overwriting the current editor state.
const badStore = memoryStorage(), emptyDb = memoryRepository(), badPort = port(doc('Segura'))
badStore.setItem(LEGACY_AUTOSAVE_KEY, '{')
badStore.setItem(RECOVERY_PREFIX + 'bad', '{}')
await startProjectPersistence(emptyDb.repository, badStore, badPort)
assert.equal(badPort.document(), doc('Segura')); assert.equal(badStore.getItem(LEGACY_AUTOSAVE_KEY), '{')
assert.equal(badStore.getItem(RECOVERY_PREFIX + 'bad'), '{}'); assert.ok(badPort.warning())

// All supported JSON versions migrate through the same editor validation.
for (const version of [1,2,3,4,5,6]) {
  const legacyStorage = memoryStorage(), legacyDb = memoryRepository()
  const legacy = JSON.stringify({ ...JSON.parse(doc('Versión antigua')), version })
  legacyStorage.setItem(LEGACY_AUTOSAVE_KEY, legacy)
  const migrated = await startProjectPersistence(legacyDb.repository, legacyStorage, port(doc('Nueva')))
  assert.equal(migrated.current().document, legacy)
  assert.equal(legacyStorage.getItem(LEGACY_AUTOSAVE_KEY), legacy)
}
// A missing recovery store must not stop an available IndexedDB from saving.
const fullStorage = memoryStorage(), availableDb = memoryRepository(), fullPort = port(doc('Inicial'))
const withoutJournal = await startProjectPersistence(availableDb.repository, fullStorage, fullPort)
fullStorage.setItem = () => { throw Error('quota') }
fullPort.edit(doc('Guardada en IndexedDB')); await withoutJournal.flush()
assert.equal((await availableDb.repository.get(withoutJournal.current().id))!.document, doc('Guardada en IndexedDB'))
assert.match(fullPort.warning(), /copia de recuperación/)
assert.throws(() => resolveLocalWrite(foreign, { ...foreign, accountId: null }), /another account/)
// A fork resets cloud ancestry for both the in-flight snapshot and later edits.
const remoteDb = memoryRepository(), remoteStorage = memoryStorage()
const remoteDocument = doc('Sincronizada')
await remoteDb.repository.write({ ...newLocalProject(remoteDocument), baseRevision: 12, syncedDocument: cloudDocument(remoteDocument), pending: false })
const deviceAPort = port(doc('')), deviceBPort = port(doc(''))
const deviceA = await startProjectPersistence(remoteDb.repository, remoteStorage, deviceAPort)
const deviceB = await startProjectPersistence(remoteDb.repository, remoteStorage, deviceBPort)
deviceAPort.edit(doc('A')); await deviceA.flush()
deviceBPort.edit(doc('B1')); const b1 = deviceB.flush()
deviceBPort.edit(doc('B2')); const b2 = deviceB.flush()
await Promise.all([b1, b2])
assert.equal(deviceB.current().baseRevision, null)
assert.equal(deviceB.current().syncedDocument, null)
assert.equal(deviceB.current().pending, true)
assert.equal((await remoteDb.repository.get(deviceB.current().id))!.baseRevision, null)

// Recovery-only fallback never overwrites the migration source and imports
// remain independent until IndexedDB is available again.
const fallbackStorage = memoryStorage(), fallbackPort = port(doc('Inicial'))
fallbackStorage.setItem(LEGACY_AUTOSAVE_KEY, doc('Fuente antigua'))
const fallback = startRecoveryPersistence(fallbackStorage, fallbackPort)
fallbackPort.edit(doc('Edición sin IndexedDB')); fallback.flush()
await fallback.create(doc('Importada sin IndexedDB'))
assert.equal(fallbackStorage.getItem(LEGACY_AUTOSAVE_KEY), doc('Fuente antigua'))
const fallbackReloadPort = port(doc('Vacía'))
startRecoveryPersistence(fallbackStorage, fallbackReloadPort)
assert.equal(fallbackReloadPort.document(), doc('Importada sin IndexedDB'))
const returnedDb = memoryRepository()
await startProjectPersistence(returnedDb.repository, fallbackStorage, port(doc('Nueva')))
const returnedNames = (await returnedDb.repository.list(null)).map(p => JSON.parse(p.document).projectName)
assert.ok(returnedNames.includes('Edición sin IndexedDB'))
assert.ok(returnedNames.includes('Importada sin IndexedDB'))

// A full disk cannot leave a signed-out account visible or overwrite its journal.
const scopeDb = memoryRepository(), scopeStorage = memoryStorage(), scopePort = port(doc('Anónima'))
const scopes = await startProjectPersistence(scopeDb.repository, scopeStorage, scopePort)
await scopes.setAccount('owner-a')
await scopes.create(doc('Privada A'), 'owner-a')
scopePort.edit(doc('Pendiente A')); scopeDb.fail(true)
await scopes.setAccount(null)
assert.equal(scopes.current().accountId, null)
assert.equal(scopePort.document(), doc('Anónima'))
assert.ok((await scopes.list()).every(p => p.accountId === null))
scopePort.edit(doc('Pendiente anónima')); await assert.rejects(scopes.flush)
const journals = [...scopeStorage.values.values()].map(value => JSON.parse(value))
assert.ok(journals.some(p => p.accountId === 'owner-a' && p.document === doc('Pendiente A')))
assert.ok(journals.some(p => p.accountId === null && p.document === doc('Pendiente anónima')))
scopeDb.fail(false); await scopes.setAccount('owner-a')
assert.equal(scopePort.document(), doc('Pendiente A'))

console.log('Local projects: migration, identities, imports, queued saves, stale tabs, crash recovery, idempotency, drafts, account isolation and invalid sources passed.')
