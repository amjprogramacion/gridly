import { cloudDocument, editLocalProject, newLocalProject, validateLocalProject, type LocalProject, type ProjectRepository } from './localProjects.ts'

export const LEGACY_AUTOSAVE_KEY = 'gridly.autosave'
export const RECOVERY_PREFIX = 'gridly.recovery.'
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
interface EditorPort {
  document(): string
  validate(document: string): void
  restore(document: string): void
  error(message: string): void
}

// If IndexedDB cannot open, edits must still enter recovery, never the old
// migration source: otherwise they would be ignored when IndexedDB returns.
export function startRecoveryPersistence(storage: RecoveryStorage, editor: EditorPort) {
  const legacy = storage.getItem(LEGACY_AUTOSAVE_KEY)
  if (legacy !== null) {
    try { editor.validate(legacy); editor.restore(legacy) } catch { /* Keep invalid source intact. */ }
  }
  let latest: LocalProject | undefined
  for (let index = 0; index < storage.length; index++) {
    const savedKey = storage.key(index)
    if (!savedKey?.startsWith(RECOVERY_PREFIX)) continue
    try {
      const recovered: unknown = JSON.parse(storage.getItem(savedKey)!)
      validateLocalProject(recovered)
      if (recovered.accountId !== null) continue
      editor.validate(recovered.document)
      if (!latest || recovered.updatedAt >= latest.updatedAt) latest = recovered
    } catch { /* Recovery sources remain untouched while IndexedDB is unavailable. */ }
  }
  if (latest) editor.restore(latest.document)
  let project = newLocalProject(editor.document())
  let key = RECOVERY_PREFIX + crypto.randomUUID()
  let persistedDocument = project.document
  function flush() {
    const document = editor.document()
    if (document === persistedDocument) return
    const desired = editLocalProject(project, document)
    storage.setItem(key, JSON.stringify(desired))
    project = desired; persistedDocument = document
  }
  async function create(document: string) {
    editor.validate(document); flush()
    const desired = newLocalProject(document), nextKey = RECOVERY_PREFIX + crypto.randomUUID()
    storage.setItem(nextKey, JSON.stringify(desired))
    project = desired; key = nextKey; persistedDocument = document
    editor.restore(document)
  }
  return { flush, create }
}

export async function startProjectPersistence(repository: ProjectRepository, storage: RecoveryStorage, editor: EditorPort) {
  let journalKey = RECOVERY_PREFIX + crypto.randomUUID()
  let project: LocalProject
  let accountId: string | null = null
  let scopeEpoch = 0
  function ensureContext(epoch: number, id?: string) {
    if (epoch !== scopeEpoch || id !== undefined && project.id !== id) throw Error('Project context changed')
  }
  let tail = Promise.resolve()
  let warning = ''
  // Journals are independent per tab; keep malformed entries for manual recovery.
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => !!key?.startsWith(RECOVERY_PREFIX))
  for (const key of keys) {
    const raw = storage.getItem(key)
    try {
      const recovered: unknown = JSON.parse(raw!)
      validateLocalProject(recovered)
      if (recovered.accountId !== null) continue // Other accounts must not load into the anonymous editor.
      editor.validate(recovered.document)
      const saved = await repository.write(recovered)
      if (saved.id !== recovered.id) warning = 'Se conservaron ambas versiones de un proyecto modificado en otra pestaña.'
      if (storage.getItem(key) === raw) storage.removeItem(key)
    } catch {
      warning = 'No se pudo recuperar una copia local. Se conserva para recuperación; descarga tu proyecto como respaldo.'
    }
  }
  const active = await repository.active(null)
  if (active) {
    validateLocalProject(active); editor.validate(active.document)
    project = active
    editor.restore(project.document)
  } else {
    const legacy = storage.getItem(LEGACY_AUTOSAVE_KEY)
    let document = editor.document()
    if (legacy !== null) {
      try { editor.validate(legacy); document = legacy } catch {
        warning = 'No se pudo recuperar el autoguardado anterior. Se conserva intacto; puedes abrir un proyecto JSON válido.'
      }
    }
    project = await repository.write(newLocalProject(document))
    if (legacy !== null && document === legacy) editor.restore(document)
    // Keep the old autosave untouched even after successful migration.
  }
  editor.error(warning)
  let persistedWriteId = project.writeId
  let anonymousFallback = { ...project }

  function capture() {
    const document = editor.document()
    if (document !== project.document) project = editLocalProject(project, document)
    return { ...project }
  }
  function flush(): Promise<void> {
    const desired = capture()
    // Merely opening a menu or leaving an unchanged stale tab is not an edit.
    if (desired.writeId === persistedWriteId) return tail
    let raw: string
    try {
      raw = JSON.stringify(desired)
      storage.setItem(journalKey, raw)
    } catch {
      editor.error('No se pudo guardar la copia de recuperación. Usa Descargar proyecto para conservar los cambios.')
      // Still attempt IndexedDB if localStorage is blocked/full.
      raw = ''
    }
    const task = tail.then(async () => {
      if (desired.id !== project.id && project.recoveredFrom !== desired.id) throw Error('Project context changed')
      // A preceding write may have advanced our own version or created a fork.
      const pending = { ...desired, id: project.id, localVersion: project.localVersion, recoveredFrom: project.recoveredFrom,
        baseRevision: project.baseRevision, syncedDocument: project.syncedDocument,
        pending: cloudDocument(desired.document) !== project.syncedDocument }
      const saved = await repository.write(pending)
      persistedWriteId = saved.writeId
      const newer = project.writeId !== desired.writeId
      project = newer ? { ...project, id: saved.id, localVersion: saved.localVersion, recoveredFrom: saved.recoveredFrom,
        baseRevision: saved.baseRevision, syncedDocument: saved.syncedDocument,
        ...(saved.id !== desired.id ? { outbox: saved.outbox, conflict: saved.conflict } : {}),
        pending: cloudDocument(project.document) !== saved.syncedDocument } : saved
      // recoveredFrom records ancestry, not a conflict in this write.
      const saveWarning = saved.id !== pending.id ? 'Otra pestaña modificó este proyecto. Tu trabajo se ha conservado como una copia independiente.' : ''
      if (raw && storage.getItem(journalKey) === raw) storage.removeItem(journalKey)
      editor.error(raw ? saveWarning : 'Proyecto guardado, pero la copia de recuperación no está disponible. Usa Descargar proyecto como respaldo.')
    })
    tail = task.catch(() => {
      editor.error('No se pudo autoguardar el proyecto. La copia de recuperación se conservará si está disponible. Usa Descargar proyecto como respaldo.')
    })
    return task
  }

  async function open(id: string) {
    const epoch = scopeEpoch
    await flush(); ensureContext(epoch)
    const saved = await repository.get(id)
    ensureContext(epoch)
    if (!saved || saved.deletedAt || saved.accountId !== null && saved.accountId !== accountId) throw Error('Project unavailable')
    validateLocalProject(saved); editor.validate(saved.document)
    await repository.activate(saved); ensureContext(epoch)
    project = saved; persistedWriteId = saved.writeId; editor.restore(saved.document)
  }
  async function create(document: string, owner: string | null = null) {
    const epoch = scopeEpoch
    if (owner !== null && owner !== accountId) throw Error('Account unavailable')
    editor.validate(document)
    await flush()
    ensureContext(epoch)
    const saved = await repository.write({ ...newLocalProject(document), accountId: owner })
    ensureContext(epoch)
    project = saved; persistedWriteId = saved.writeId; editor.restore(document)
    return saved.id
  }
  async function revise(transform: (current: LocalProject) => LocalProject) {
    const epoch = scopeEpoch, id = project.id
    await flush(); ensureContext(epoch, id)
    const changed = transform({ ...project })
    if (JSON.stringify(changed) === JSON.stringify(project)) return { ...project }
    if (changed.id !== project.id || changed.accountId !== project.accountId) throw Error('Cannot reassign project')
    editor.validate(changed.document)
    if (changed.document !== project.document) editor.restore(changed.document)
    project = { ...changed, writeId: crypto.randomUUID() }
    await flush()
    return { ...project }
  }
  async function setAccount(owner: string | null) {
    const epoch = ++scopeEpoch
    // Session changes must hide the previous account even if storage is full.
    // Leave its journal intact and use a different key in the new scope.
    try { await flush() } catch { /* Pending work remains in its recovery journal. */ }
    ensureContext(epoch)
    if (project.accountId === null) anonymousFallback = { ...project }
    accountId = owner
    journalKey = RECOVERY_PREFIX + crypto.randomUUID()
    // Only recover journals belonging to the newly authenticated account.
    if (owner !== null) {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => !!key?.startsWith(RECOVERY_PREFIX))
      for (const key of keys) {
        const raw = storage.getItem(key)
        try {
          const recovered: unknown = JSON.parse(raw!)
          validateLocalProject(recovered)
          if (recovered.accountId !== owner) continue
          editor.validate(recovered.document)
          await repository.write(recovered)
          if (storage.getItem(key) === raw) storage.removeItem(key)
        } catch { editor.error('Una copia pendiente no pudo recuperarse; se conserva en este dispositivo.') }
      }
    }
    let active: LocalProject | undefined
    try {
      active = await repository.active(owner) ?? await repository.active(null)
      if (active) {
        validateLocalProject(active); editor.validate(active.document)
        if (active.accountId !== null && active.accountId !== owner) throw Error('Account unavailable')
      }
    } catch {
      active = undefined
      editor.error('No se pudo leer el almacenamiento. Descarga el proyecto como respaldo.')
    }
    ensureContext(epoch)
    project = active ?? { ...anonymousFallback }
    persistedWriteId = active ? active.writeId : ''
    editor.restore(project.document)
  }
  async function openRemote(remote: { id: string; document: string; revision: number; updatedAt: string }) {
    if (!accountId) throw Error('Authentication required')
    const epoch = scopeEpoch, owner = accountId
    await flush(); ensureContext(epoch)
    const cached = await repository.get(remote.id)
    ensureContext(epoch)
    if (cached) {
      if (cached.deletedAt) { await repository.setDeleted([cached.id], owner, false); ensureContext(epoch) }
      await open(cached.id); return
    }
    editor.validate(remote.document)
    const saved = await repository.write({ ...newLocalProject(remote.document), id: remote.id, accountId: owner,
      baseRevision: remote.revision, syncedDocument: cloudDocument(remote.document), pending: false, updatedAt: remote.updatedAt })
    ensureContext(epoch)
    project = saved; persistedWriteId = saved.writeId; editor.restore(saved.document)
  }
  async function list(deleted = false) {
    const epoch = scopeEpoch, owner = accountId
    const local = await repository.list(null, deleted)
    const result = owner === null ? local : [...local, ...await repository.list(owner, deleted)]
    ensureContext(epoch)
    return result
  }
  async function setDeleted(ids: string[], deleted: boolean, emptyDocument: string) {
    const epoch = scopeEpoch
    await flush(); ensureContext(epoch)
    await repository.setDeleted(ids, accountId, deleted); ensureContext(epoch)
    if (deleted && ids.includes(anonymousFallback.id)) anonymousFallback = newLocalProject(emptyDocument)
    if (deleted && ids.includes(project.id)) {
      const remaining = await list()
      if (remaining[0]) await open(remaining[0].id)
      else await create(emptyDocument)
    }
  }
  return { flush, open, create, revise, setAccount, openRemote, list, setDeleted, current: () => ({ ...project }) }
}
