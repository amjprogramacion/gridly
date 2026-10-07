import assert from 'node:assert/strict'
import { canonicalDocument, newLocalProject, projectRows, resolveLocalWrite } from '../src/localProjects.ts'
import { startProjectPersistence } from '../src/projectPersistence.ts'
import { doc, memoryRepository, memoryStorage, port } from './helpers/projectFixtures.ts'

const base = newLocalProject(doc('Despacho'))
const account = { ...base, id: crypto.randomUUID(), accountId: 'a', localVersion: 2 }
const recovered = { ...account, id: crypto.randomUUID(), recoveredFrom: account.id }
const different = { ...account, id: crypto.randomUUID(), document: JSON.stringify({ ...JSON.parse(base.document), room: { ...JSON.parse(base.document).room, width: 5000 } }) }
const rows = projectRows([base, account, recovered, different], account.id)
assert.equal(rows.length, 1)
assert.equal(rows[0]!.copies.length, 4)
assert.equal(rows[0]!.versions.length, 2)
assert.equal(rows[0]!.project.id, account.id)
const draft = { ...base, id: crypto.randomUUID(), document: JSON.stringify({ ...JSON.parse(base.document), customDraft: { name: 'Pendiente' } }) }
assert.equal(projectRows([base,draft], base.id)[0]!.versions.length, 2)
assert.notEqual(canonicalDocument(base.document), canonicalDocument(draft.document))
// A metadata update from another tab does not manufacture another scene.
assert.equal(resolveLocalWrite(account, { ...account, localVersion: 1, writeId: crypto.randomUUID() }).id, account.id)
assert.notEqual(resolveLocalWrite(account, { ...different, id: account.id, localVersion: 1, writeId: crypto.randomUUID() }).id, account.id)

const db = memoryRepository(), storage = memoryStorage(), editor = port(doc('Eliminar'))
const local = await startProjectPersistence(db.repository, storage, editor)
const stale = await startProjectPersistence(db.repository, storage, port(doc('Vacía')))
const id = local.current().id
await local.setDeleted([id], true, doc('Nueva'))
assert.equal((await local.list()).some(p => p.id === id), false)
assert.equal((await local.list(true))[0]!.id, id)
assert.notEqual(local.current().id, id)
await assert.rejects(local.open(id))
await assert.rejects(db.repository.write({ ...stale.current(), writeId: crypto.randomUUID() }), /deleted/)
const reload = await startProjectPersistence(db.repository, storage, port(doc('Vacía')))
assert.equal((await reload.list(true))[0]!.id, id)
await reload.setDeleted([id], false, doc('Nueva'))
await reload.open(id)
assert.equal(reload.current().document, doc('Eliminar'))
const foreign = { ...newLocalProject(doc('Ajena')), accountId: 'another' }
await db.repository.write(foreign)
await assert.rejects(reload.setDeleted([foreign.id], true, doc('Nueva')))
assert.equal((await db.repository.get(foreign.id))!.deletedAt, undefined)
console.log('Project list: one row per name, distinct versions/drafts preserved, unchanged stale saves, recoverable deletion, reload, stale-tab rejection and ownership passed.')
