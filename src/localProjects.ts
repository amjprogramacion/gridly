// Metadata belongs to local persistence, not the portable Gridly JSON format.
export interface LocalProject {
  id: string
  accountId: string | null
  document: string
  baseRevision: number | null
  syncedDocument: string | null
  pending: boolean
  localVersion: number
  writeId: string
  updatedAt: string
  recoveredFrom?: string
  deletedAt?: string
  outbox?: { id: string; document: string; baseRevision: number | null }
  conflict?: { document: string; revision: number; updatedAt: string }
}

export function canonicalDocument(document: string, includeDraft = true): string {
  const { customDraft, ...project } = JSON.parse(document)
  if (includeDraft && customDraft !== undefined) project.customDraft = customDraft
  function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0).map(([key,item])=>[key,sorted(item)]))
    return value
  }
  return JSON.stringify(sorted(project))
}
export const cloudDocument = (document: string) => canonicalDocument(document, false)

// One row per name, retaining distinct documents as selectable versions.
export function projectRows(projects: LocalProject[], activeId: string) {
  const groups = new Map<string, LocalProject[]>()
  for (const project of projects) {
    const key = JSON.parse(project.document).projectName as string
    groups.set(key, [...(groups.get(key) ?? []), project])
  }
  return [...groups.values()].map(copies => {
    copies.sort((a,b) => Number(b.id === activeId) - Number(a.id === activeId) || Number(!!b.accountId) - Number(!!a.accountId) || b.updatedAt.localeCompare(a.updatedAt))
    const documents = new Set<string>()
    const versions = copies.filter(p => { const key = canonicalDocument(p.document); if (documents.has(key)) return false; documents.add(key); return true })
    return { project: copies[0]!, copies, versions }
  }).sort((a,b) => b.project.updatedAt.localeCompare(a.project.updatedAt))
}

export function newLocalProject(document: string): LocalProject {
  return {
    id: crypto.randomUUID(), accountId: null, document, baseRevision: null,
    syncedDocument: null, pending: true, localVersion: 0,
    writeId: crypto.randomUUID(), updatedAt: new Date().toISOString(),
  }
}

export function editLocalProject(project: LocalProject, document: string): LocalProject {
  return {
    ...project, document, pending: cloudDocument(document) !== project.syncedDocument,
    writeId: crypto.randomUUID(), updatedAt: new Date().toISOString(),
  }
}

// Called inside the same transaction as the write. A stale tab creates a copy.
export function resolveLocalWrite(current: LocalProject | undefined, desired: LocalProject): LocalProject {
  if (current && current.accountId !== desired.accountId) throw Error('Project belongs to another account')
  if (current?.deletedAt) throw Error('Project deleted')
  if (current?.writeId === desired.writeId) return current
  if (current && current.localVersion !== desired.localVersion && canonicalDocument(current.document) === canonicalDocument(desired.document)) return current
  if (!current && desired.localVersion === 0 || current?.localVersion === desired.localVersion) {
    return { ...desired, localVersion: desired.localVersion + 1 }
  }
  return {
    ...desired, id: desired.writeId, recoveredFrom: desired.id,
    baseRevision: null, syncedDocument: null, pending: true, localVersion: 1,
    outbox: undefined, conflict: undefined,
  }
}

export interface ProjectRepository {
  active(accountId: string | null): Promise<LocalProject | undefined>
  get(id: string): Promise<LocalProject | undefined>
  list(accountId: string | null, deleted?: boolean): Promise<LocalProject[]>
  write(project: LocalProject): Promise<LocalProject>
  activate(project: LocalProject): Promise<void>
  setDeleted(ids: string[], accountId: string | null, deleted: boolean): Promise<void>
}

export function validateLocalProject(value: unknown): asserts value is LocalProject {
  const p = value as LocalProject
  if (!p || typeof p.id !== 'string' || !p.id ||
    p.accountId !== null && typeof p.accountId !== 'string' ||
    typeof p.document !== 'string' ||
    p.baseRevision !== null && (!Number.isSafeInteger(p.baseRevision) || p.baseRevision < 0) ||
    p.syncedDocument !== null && typeof p.syncedDocument !== 'string' ||
    typeof p.pending !== 'boolean' || !Number.isSafeInteger(p.localVersion) || p.localVersion < 0 ||
    typeof p.writeId !== 'string' || !p.writeId || typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt)) ||
    p.recoveredFrom !== undefined && typeof p.recoveredFrom !== 'string' ||
    p.deletedAt !== undefined && !Number.isFinite(Date.parse(p.deletedAt))) throw Error('Invalid local project')
  if (p.outbox && (typeof p.outbox.id !== 'string' || !p.outbox.id || typeof p.outbox.document !== 'string' ||
    p.outbox.baseRevision !== null && (!Number.isSafeInteger(p.outbox.baseRevision) || p.outbox.baseRevision < 1))) throw Error('Invalid pending operation')
  if (p.conflict && (typeof p.conflict.document !== 'string' || !Number.isSafeInteger(p.conflict.revision) || p.conflict.revision < 1 || !Number.isFinite(Date.parse(p.conflict.updatedAt)))) throw Error('Invalid conflict')
}
