import assert from 'node:assert/strict'
import { createCloudSync, type CloudTransport, type RemoteProject, type SaveResult, type SyncStatus } from '../src/cloudSync.ts'
import { cloudDocument, type LocalProject } from '../src/localProjects.ts'
import { startProjectPersistence } from '../src/projectPersistence.ts'
import { parseProject } from '../src/editor.ts'
import { memoryRepository, memoryStorage, doc, port } from './helpers/projectFixtures.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
function server() {
  const records = new Map<string, RemoteProject>(), operations = new Map<string, SaveResult>()
  let beforeSave: (() => Promise<void>) | undefined, beforeGet: (() => Promise<void>) | undefined, lost = false, calls = 0
  const transport: CloudTransport = {
    get: async id => { await beforeGet?.(); return records.get(id) },
    save: async (id, op) => {
      calls++; await beforeSave?.()
      if (operations.has(op.id)) return operations.get(op.id)!
      const previous = records.get(id)
      if (previous && previous.revision !== op.baseRevision) return { status: 'conflict', ...previous }
      const saved = { id, document: op.document, revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() }
      records.set(id, saved)
      const result: SaveResult = { status: 'saved', revision: saved.revision, updatedAt: saved.updatedAt }
      operations.set(op.id, result)
      if (lost) { lost = false; throw Error('Response lost after commit') }
      return result
    },
  }
  return { records, operations, transport, count: () => calls, loseResponse: () => { lost = true }, onSave: (f?: () => Promise<void>) => { beforeSave = f }, onGet: (f?: () => Promise<void>) => { beforeGet = f } }
}
const owner = '00000000-0000-4000-8000-000000000001'
async function device(cloud: ReturnType<typeof server>, document = doc('Local')) {
  const db = memoryRepository(), storage = memoryStorage(), editor = port(document)
  const local = await startProjectPersistence(db.repository, storage, editor)
  let account: string | null = owner, apply = true, status: SyncStatus = 'local'
  await local.setAccount(owner)
  const engine = createCloudSync(local, cloud.transport, {
    account: () => account, canApply: () => apply, validate: value => { parseProject(value) }, status: value => { status = value },
  })
  return { db, storage, editor, local, engine, status: () => status, account: (value: string | null) => { account = value; engine.cancel() }, apply: (value: boolean) => { apply = value } }
}

const cloud = server(), a = await device(cloud)
await a.engine.sync(); assert.equal(cloud.count(), 0); assert.equal(a.status(), 'local')
// Upload is explicit and preserves the anonymous original.
const anonymousId = a.local.current().id
await a.local.create(doc('En mi cuenta'), owner)
await a.engine.sync()
const cloudId = a.local.current().id
assert.notEqual(cloudId, anonymousId)
assert.equal(a.local.current().baseRevision, 1); assert.equal(a.local.current().pending, false)
assert.equal(a.status(), 'synced'); assert.ok(await a.db.repository.get(anonymousId))

// A later edit made while snapshot 1 is in flight survives its acknowledgement.
const saving = deferred(), release = deferred()
cloud.onSave(async () => { saving.resolve(); await release.promise })
a.editor.edit(doc('Primera edición')); const uploading = a.engine.sync()
await saving.promise
a.editor.edit(doc('Edición durante subida')); await a.local.flush()
release.resolve(); await uploading; cloud.onSave()
assert.equal(a.editor.document(), doc('Edición durante subida'))
assert.equal(a.local.current().pending, true); assert.equal(a.local.current().baseRevision, 2)
assert.equal(cloud.records.get(cloudId)!.document, cloudDocument(doc('Primera edición')))
await a.engine.sync(); assert.equal(a.local.current().pending, false)
assert.equal(cloud.records.get(cloudId)!.document, cloudDocument(doc('Edición durante subida')))

// Losing a committed response and reloading retries the same durable operation.
cloud.loseResponse(); a.editor.edit(doc('Respuesta perdida')); await a.engine.sync()
assert.equal(a.status(), 'offline')
const pendingId = a.local.current().outbox!.id, revision = cloud.records.get(cloudId)!.revision
const reopened = await startProjectPersistence(a.db.repository, a.storage, port(doc('Vacía')))
await reopened.setAccount(owner)
const retry = createCloudSync(reopened, cloud.transport, { account: () => owner, canApply: () => true, validate: value => { parseProject(value) }, status: () => {} })
await retry.sync()
assert.equal(cloud.records.get(cloudId)!.revision, revision)
assert.ok(cloud.operations.has(pendingId)); assert.equal(reopened.current().outbox, undefined)

// A second device from an older revision cannot overwrite the first device.
const b = await device(cloud)
await b.local.openRemote(cloud.records.get(cloudId)!)
// Reload A's local metadata after the recovery above to avoid a stale-tab fork.
await a.local.open(cloudId)
a.editor.edit(doc('Cambio A')); await a.engine.sync()
b.editor.edit(doc('Cambio B')); await b.engine.sync()
assert.equal(b.status(), 'conflict')
assert.equal(b.editor.document(), doc('Cambio B'))
assert.equal(b.local.current().conflict!.document, cloudDocument(doc('Cambio A')))
const calls = cloud.count(); await b.engine.sync(); assert.equal(cloud.count(), calls)

// Remote updates wait for gestures/inputs, then update a clean scene.
const c = await device(cloud)
await c.local.openRemote(cloud.records.get(cloudId)!)
a.editor.edit(doc('Remota nueva')); await a.engine.sync()
c.apply(false); await c.engine.sync()
assert.equal(cloudDocument(c.editor.document()), cloudDocument(doc('Cambio A')))
c.apply(true); await c.engine.sync()
assert.equal(cloudDocument(c.editor.document()), cloudDocument(doc('Remota nueva')))

// Starting a local edit while an incoming download runs produces a conflict.
const reading = deferred(), releaseRead = deferred()
a.editor.edit(doc('Otra remota')); await a.engine.sync()
cloud.onGet(async () => { reading.resolve(); await releaseRead.promise })
const downloading = c.engine.sync(); await reading.promise
c.editor.edit(doc('Local durante descarga')); await c.local.flush()
releaseRead.resolve(); await downloading; cloud.onGet()
assert.equal(c.status(), 'conflict'); assert.equal(c.editor.document(), doc('Local durante descarga'))

// A session change invalidates a late success without marking another account.
const d = await device(cloud)
await d.local.create(doc('Cuenta A pendiente'), owner)
const accountStart = deferred(), accountRelease = deferred()
cloud.onSave(async () => { accountStart.resolve(); await accountRelease.promise })
const oldSessionUpload = d.engine.sync(); await accountStart.promise
const oldProjectId = d.local.current().id
d.account(null); await d.local.setAccount(null)
const afterSignOut = d.local.current()
accountRelease.resolve(); await oldSessionUpload; cloud.onSave()
assert.deepEqual(d.local.current(), afterSignOut)
assert.equal((await d.db.repository.get(oldProjectId))!.outbox?.document, cloudDocument(doc('Cuenta A pendiente')))
assert.equal(d.local.current().accountId, null)

// Drafts never enter the remote document; invalid received geometry is rejected.
const e = await device(cloud)
await e.local.create(doc('Taller'), owner); await e.engine.sync()
e.editor.edit(JSON.stringify({ ...JSON.parse(doc('Taller')), customDraft: { objects: [] } }))
await e.local.flush(); const beforeDraftCalls = cloud.count(); await e.engine.sync()
assert.equal(cloud.count(), beforeDraftCalls)
assert.equal(JSON.parse(cloud.records.get(e.local.current().id)!.document).customDraft, undefined)
cloud.records.set(e.local.current().id, { id: e.local.current().id, document: '{}', revision: 2, updatedAt: new Date().toISOString() })
const beforeInvalid = e.editor.document(); await e.engine.sync()
assert.equal(e.status(), 'error'); assert.equal(e.editor.document(), beforeInvalid)

// A successful idempotent retry from an older revision still detects newer data.
const f = await device(cloud)
await f.local.create(doc('Base'), owner); await f.engine.sync()
cloud.loseResponse(); f.editor.edit(doc('Subida incierta')); await f.engine.sync()
const uncertain = f.local.current(), accepted = cloud.records.get(uncertain.id)!
cloud.records.set(uncertain.id, { ...accepted, document: cloudDocument(doc('Otro dispositivo')), revision: accepted.revision + 1 })
await f.engine.sync()
assert.equal(cloudDocument(f.editor.document()), cloudDocument(doc('Otro dispositivo')))
assert.equal(f.local.current().baseRevision, accepted.revision + 1)
// An edit beginning during the final persistence flush also wins over download.
const g = await device(cloud)
await g.local.openRemote(cloud.records.get(cloudId)!)
a.editor.edit(doc('Remota al aplicar')); await a.engine.sync()
const applyStarted = deferred(), applyRelease = deferred()
let applyStatus: SyncStatus = 'local'
const gated = createCloudSync({ ...g.local, revise: async transform => {
  applyStarted.resolve(); await applyRelease.promise
  return g.local.revise(transform)
} }, cloud.transport, { account: () => owner, canApply: () => true, validate: value => { parseProject(value) }, status: value => { applyStatus = value } })
const finalDownload = gated.sync(); await applyStarted.promise
g.editor.edit(doc('Edición justo antes de aplicar')); await g.local.flush()
applyRelease.resolve(); await finalDownload
assert.equal(applyStatus, 'conflict')
assert.equal(g.editor.document(), doc('Edición justo antes de aplicar'))
assert.equal(g.local.current().conflict!.document, cloudDocument(doc('Remota al aplicar')))

console.log('Cloud sync: explicit uploads, durable retries, edits during upload/download, stale revisions, remote update deferral, account changes, drafts and invalid documents passed.')
