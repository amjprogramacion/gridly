import { ref, watch } from 'vue'
import type { LocalProject } from './localProjects.ts'
import { parseProject, projectJSON, projectRevision, restoreProject, setProjectImporter, state } from './editor.ts'
import { openProjectRepository } from './projectRepository.ts'
import { startProjectPersistence, startRecoveryPersistence } from './projectPersistence.ts'

export const currentProject = ref<LocalProject>()
export const projectTransition = ref(false)
export function publishProject() {
  const current = localProjects?.current()
  if (JSON.stringify(current) !== JSON.stringify(currentProject.value)) currentProject.value = current
}
export let localProjects: Awaited<ReturnType<typeof startProjectPersistence>> | undefined
export async function initializeLocalProjects() {
  try {
    const repository = await openProjectRepository(window.indexedDB)
    localProjects = await startProjectPersistence(repository, window.localStorage, {
      document: projectJSON, validate: document => { parseProject(document) },
      restore: restoreProject, error: message => { state.autosaveError = message },
    })
    const persistence = localProjects
    publishProject()
    setProjectImporter(async document => {
      projectTransition.value = true
      try { return await persistence.create(document) } finally { publishProject(); projectTransition.value = false }
    })
    const flush = () => { void persistence.flush().then(publishProject).catch(() => {}) }
    watch(projectRevision, flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
  } catch {
    // A blocked/unavailable database must not prevent editing or JSON export.
    try {
      const fallback = startRecoveryPersistence(window.localStorage, {
        document: projectJSON, validate: document => { parseProject(document) },
        restore: restoreProject, error: message => { state.autosaveError = message },
      })
      setProjectImporter(fallback.create)
      const flush = () => {
        try { fallback.flush() } catch { state.autosaveError = 'No se pudo autoguardar. Usa Descargar proyecto para conservar los cambios.' }
      }
      watch(projectRevision, flush)
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
    } catch { /* Editing and download remain available if both stores are blocked. */ }
    state.autosaveError = 'No se pudo abrir el almacenamiento de proyectos. Se conservarán copias de recuperación si están disponibles; descarga tu proyecto como respaldo.'
  }
}
