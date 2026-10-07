import { cloudDocument, type LocalProject } from './localProjects.ts'

export interface RemoteProject { id: string; document: string; revision: number; updatedAt: string }
export type SaveResult = { status: 'saved'; revision: number; updatedAt: string } | { status: 'conflict'; revision: number; document: string; updatedAt: string } | { status: 'missing' }
export interface CloudTransport {
  get(id: string): Promise<RemoteProject | undefined>
  save(id: string, operation: NonNullable<LocalProject['outbox']>): Promise<SaveResult>
}
export interface SyncLocal {
  flush(): Promise<void>
  current(): LocalProject
  revise(transform: (project: LocalProject) => LocalProject): Promise<LocalProject>
}
export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error'
class InvalidDocument extends Error {}

// Only one snapshot is in flight. Its operation survives reload/network failure.
export function createCloudSync(local: SyncLocal, cloud: CloudTransport, options: {
  account(): string | null
  validate(document: string): void
  canApply(): boolean
  status(value: SyncStatus, message?: string): void
}) {
  let running: Promise<void> | undefined
  let epoch = 0
  function cancel() { epoch++ }
  function validate(document: string) {
    try { options.validate(document) } catch { throw new InvalidDocument('Invalid cloud document') }
  }
  async function run() {
    const generation = epoch, account = options.account()
    await local.flush()
    const initial = local.current(), id = initial.id
    const valid = () => epoch === generation && options.account() === account && local.current().id === id && local.current().accountId === account
    if (!account || initial.accountId !== account) { options.status('local'); return }
    if (!valid()) return
    const revise = (transform: (project: LocalProject) => LocalProject) => local.revise(project => valid() && project.id === id && project.accountId === account ? transform(project) : project)
    if (initial.conflict) { options.status('conflict'); return }
    options.status('syncing')
    if (initial.pending || initial.outbox) {
      if (!initial.outbox) {
        await revise(project => ({ ...project, outbox: { id: crypto.randomUUID(), document: cloudDocument(project.document), baseRevision: project.baseRevision } }))
      }
      if (!valid()) return
      const operation = local.current().outbox
      if (!operation) { options.status('pending'); return }
      validate(operation.document)
      const result = await cloud.save(id, operation)
      if (!valid()) return
      if (result.status === 'missing') { options.status('error', 'El proyecto ya no está disponible en la nube. Tu copia local se conserva.'); return }
      if (result.status === 'conflict') {
        validate(result.document)
        await revise(project => ({ ...project, conflict: { document: result.document, revision: result.revision, updatedAt: result.updatedAt } }))
        if (valid()) options.status('conflict')
        return
      }
      await revise(project => ({ ...project, outbox: undefined, baseRevision: result.revision,
        syncedDocument: operation.document, pending: cloudDocument(project.document) !== operation.document }))
      if (!valid()) return
      if (local.current().pending) { options.status('pending'); return }
    }
    const remote = await cloud.get(id)
    if (!valid()) return
    await local.flush()
    if (!valid()) return
    const current = local.current()
    if (!remote) { options.status('error', 'El proyecto no está disponible en la nube. Tu copia local se conserva.'); return }
    validate(remote.document)
    if (remote.revision < (current.baseRevision ?? 0)) throw new InvalidDocument('Invalid remote revision')
    let deferredUpdate = false
    if (remote.revision !== current.baseRevision) {
      if (current.pending || current.outbox) {
        await revise(project => ({ ...project, conflict: { document: remote.document, revision: remote.revision, updatedAt: remote.updatedAt } }))
        if (valid()) options.status('conflict')
        return
      }
      // A local workshop draft is retained until the user explicitly opens a copy.
      if (!options.canApply() || JSON.parse(current.document).customDraft) { options.status('pending', 'Hay una actualización disponible en otro dispositivo.'); return }
      await revise(project => {
        // revise() flushes again: recheck after that await, before replacing
        // anything, because an edit or gesture may have started meanwhile.
        if (project.pending || project.outbox) return { ...project, conflict: { document: remote.document, revision: remote.revision, updatedAt: remote.updatedAt } }
        if (!options.canApply() || JSON.parse(project.document).customDraft) { deferredUpdate = true; return project }
        return { ...project, document: remote.document, syncedDocument: cloudDocument(remote.document), baseRevision: remote.revision, pending: false }
      })
    }
    if (valid()) options.status(local.current().conflict ? 'conflict' : deferredUpdate || local.current().pending ? 'pending' : 'synced',
      deferredUpdate ? 'Hay una actualización disponible en otro dispositivo.' : undefined)
  }
  function sync() {
    if (running) return running
    const generation = epoch
    running = run().catch(error => {
      if (generation !== epoch) return
      options.status(error instanceof InvalidDocument ? 'error' : 'offline', error instanceof InvalidDocument
        ? 'La versión recibida no es un proyecto válido. Tu copia local se conserva.'
        : 'No se pudo sincronizar. Tus cambios permanecen guardados en este dispositivo.')
    }).finally(() => { running = undefined })
    return running
  }
  return { sync, cancel, idle: () => running ?? Promise.resolve() }
}
