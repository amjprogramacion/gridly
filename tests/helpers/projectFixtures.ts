import { resolveLocalWrite, type LocalProject, type ProjectRepository } from '../../src/localProjects.ts'
import { parseProject, defaultRoom } from '../../src/editor.ts'

export function memoryRepository() {
  const projects = new Map<string, LocalProject>(), active = new Map<string | null, string>()
  let failed = false
  let delay: (() => Promise<void>) | undefined
  const repository: ProjectRepository = {
    active: async account => { const p = projects.get(active.get(account)!); return p?.deletedAt ? undefined : p },
    get: async id => projects.get(id),
    list: async (account, deleted = false) => [...projects.values()].filter(p => p.accountId === account && !!p.deletedAt === deleted),
    activate: async project => { active.set(project.accountId, project.id) },
    setDeleted: async (ids, account, deleted) => {
      for (const id of ids) { const p = projects.get(id); if (p && p.accountId !== null && p.accountId !== account) throw Error('Account unavailable') }
      for (const id of ids) { const p = projects.get(id); if (p) projects.set(id, { ...p, deletedAt: deleted ? new Date().toISOString() : undefined, localVersion: p.localVersion + 1, writeId: crypto.randomUUID() }) }
    },
    write: async project => {
      await delay?.()
      if (failed) throw Error('quota')
      const accepted = resolveLocalWrite(projects.get(project.id), project)
      const saved = projects.get(accepted.id)?.writeId === project.writeId ? projects.get(accepted.id)! : accepted
      projects.set(saved.id, structuredClone(saved)); active.set(saved.accountId, saved.id)
      return structuredClone(saved)
    },
  }
  return { repository, projects, fail: (value: boolean) => { failed = value }, delay: (value?: () => Promise<void>) => { delay = value } }
}
export function memoryStorage() {
  const values = new Map<string, string>()
  return { values, get length() { return values.size }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
export const doc = (name: string) => JSON.stringify({ version: 6, units: 'mm', projectName: name, room: defaultRoom(), objects: [], collisions: false, structuralColor: '#526171', customObjects: [] })
export function port(document: string) {
  let current = document, error = ''
  return { document: () => current, validate: (value: string) => { parseProject(value) }, restore: (value: string) => { current = value }, error: (value: string) => { error = value }, edit: (value: string) => { current = value }, warning: () => error }
}
