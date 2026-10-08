import { resolveLocalWrite, validateLocalProject, type LocalProject, type ProjectRepository } from './localProjects.ts'

export const PROJECT_DATABASE = 'gridly.projects'
const scope = (accountId: string | null) => accountId === null ? 'local' : `account:${accountId}`

export async function openProjectRepository(factory: IDBFactory): Promise<ProjectRepository> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(PROJECT_DATABASE, 2)
    request.onupgradeneeded = () => {
      if(!request.result.objectStoreNames.contains('projects'))request.result.createObjectStore('projects', { keyPath: 'id' })
      if(!request.result.objectStoreNames.contains('settings'))request.result.createObjectStore('settings')
      if(!request.result.objectStoreNames.contains('recovery'))request.result.createObjectStore('recovery', {keyPath:'key'})
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(Error('Project database blocked'))
  })
  db.onversionchange = () => db.close()

  function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'settings','recovery'], mode)
      let value: T
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(tx.error ?? Error('Project transaction aborted'))
      tx.onerror = () => {} // onabort reports the failure after rollback.
      try { run(tx, result => { value = result }) } catch (error) { tx.abort(); reject(error) }
    })
  }
  const get = (id: string) => transaction<LocalProject | undefined>('readonly', (tx, result) => {
    const request = tx.objectStore('projects').get(id)
    request.onsuccess = () => result(request.result)
  })
  return {
    recovery:{
      list:accountId=>transaction<{key:string;project:LocalProject}[]>('readonly',(tx,result)=>{const request=tx.objectStore('recovery').getAll();request.onsuccess=()=>result(request.result.filter(entry=>entry.project?.accountId===accountId))}),
      write:(key,project)=>{validateLocalProject(project);return transaction<void>('readwrite',(tx,result)=>{tx.objectStore('recovery').put({key,project});result(undefined)})},
      remove:(key,writeId)=>transaction<void>('readwrite',(tx,result)=>{const store=tx.objectStore('recovery'),request=store.get(key);request.onsuccess=()=>{if(request.result?.project.writeId===writeId)store.delete(key);result(undefined)}}),
    },
    get,
    active: accountId => transaction<LocalProject | undefined>('readonly', (tx, result) => {
      const setting = tx.objectStore('settings').get(scope(accountId))
      setting.onsuccess = () => {
        if (!setting.result) { result(undefined); return }
        const request = tx.objectStore('projects').get(setting.result)
        request.onsuccess = () => result(request.result?.accountId === accountId && !request.result.deletedAt ? request.result : undefined)
      }
    }),
    list: (accountId, deleted = false) => transaction<LocalProject[]>('readonly', (tx, result) => {
      const request = tx.objectStore('projects').getAll()
      request.onsuccess = () => result((request.result as LocalProject[]).filter(p => p.accountId === accountId && !!p.deletedAt === deleted))
    }),
    write: project => {
      validateLocalProject(project)
      return transaction<LocalProject>('readwrite', (tx, result) => {
        const store = tx.objectStore('projects'), request = store.get(project.id)
        request.onsuccess = () => {
          try {
            const accepted = resolveLocalWrite(request.result, project)
            const save = (value: LocalProject) => {
              store.put(value)
              tx.objectStore('settings').put(value.id, scope(value.accountId))
              result(value)
            }
            if (accepted.id === project.id) { save(accepted); return }
            // A recovery journal may be replayed after its fork was committed.
            const fork = store.get(accepted.id)
            fork.onsuccess = () => save(fork.result?.writeId === project.writeId ? fork.result : accepted)
          } catch { tx.abort() }
        }
      })
    },
    activate: project => transaction<void>('readwrite', (tx, result) => {
      tx.objectStore('settings').put(project.id, scope(project.accountId)); result(undefined)
    }),
    setDeleted: (ids, accountId, deleted) => transaction<void>('readwrite', (tx, result) => {
      const store = tx.objectStore('projects')
      for (const id of ids) {
        const request = store.get(id)
        request.onsuccess = () => {
          const p: LocalProject | undefined = request.result
          if (!p) return
          if (p.accountId !== null && p.accountId !== accountId) { tx.abort(); return }
          store.put({ ...p, deletedAt: deleted ? new Date().toISOString() : undefined, localVersion: p.localVersion + 1, writeId: crypto.randomUUID() })
        }
      }
      result(undefined)
    }),
  }
}
