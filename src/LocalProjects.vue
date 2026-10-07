<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { localProjects, projectTransition } from './useLocalProjects.ts'
import { cloudAccount, cancelCurrentSync, waitForCurrentSync, projectChanged } from './useCloudAccount.ts'
import { listCloudProjects, cloudTransport, cloudProjectState, setCloudProjectDeleted, type CloudProjectSummary } from './supabaseClient.ts'
import { defaultRoom, DEFAULT_PROJECT_NAME, WALL_COLOR, projectJSON, state } from './editor.ts'
import { projectRows, type LocalProject } from './localProjects.ts'

const dialog = ref<HTMLDialogElement>()
const projects = ref<LocalProject[]>([])
const remoteProjects = ref<CloudProjectSummary[]>([])
const busy = ref(false)
const error = ref('')
const trash = ref(false)
const rows = computed(() => projectRows(projects.value, localProjects?.current().id ?? ''))
const remoteRows = computed(() => {
  const groups = new Map<string, CloudProjectSummary[]>()
  for (const p of remoteProjects.value) if (!rows.value.some(row => name(row.project) === p.name)) groups.set(p.name, [...(groups.get(p.name) ?? []),p])
  return [...groups.values()]
})
const remoteVersions = (projectName: string) => remoteProjects.value.filter(p => p.name === projectName)
watch(() => cloudAccount.user?.id, () => { projects.value = []; remoteProjects.value = []; dialog.value?.close() })
function name(project: LocalProject) {
  try { return JSON.parse(project.document).projectName ?? DEFAULT_PROJECT_NAME }
  catch { return 'Proyecto no disponible' }
}
async function show(reset = true) {
  if (!localProjects) return
  if (reset) trash.value = false
  const owner = cloudAccount.user?.id
  busy.value = true; error.value = ''
  try {
    await localProjects.flush()
    const local = await localProjects.list(trash.value)
    if (owner !== cloudAccount.user?.id) return
    projects.value = local.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    remoteProjects.value = []
    if (cloudAccount.user) {
      try {
        const [remote, archived] = await Promise.all([listCloudProjects(trash.value), trash.value ? Promise.resolve([]) : listCloudProjects(true)])
        if (owner !== cloudAccount.user?.id) return
        if (trash.value) {
          const cached = await localProjects.list()
          if (owner !== cloudAccount.user?.id) return
          projects.value.push(...cached.filter(p => p.accountId && remote.some(r => r.id === p.id)))
        } else projects.value = projects.value.filter(p => !archived.some(r => r.id === p.id))
        remoteProjects.value = remote.filter(project => !projects.value.some(cached => cached.id === project.id))
      }
      catch { error.value = 'No se pudo consultar la nube. Puedes abrir los proyectos guardados en este dispositivo.' }
    }
    if (owner === cloudAccount.user?.id && !dialog.value?.open) dialog.value?.showModal()
  } catch { state.autosaveError = 'No se pudieron guardar o abrir los proyectos locales. Descarga el proyecto como respaldo.' }
  finally { busy.value = false }
}
async function change(action: () => Promise<unknown>) {
  busy.value = true; error.value = ''
  projectTransition.value = true; cancelCurrentSync()
  try { await action(); projectChanged(); dialog.value?.close() }
  catch { error.value = 'No se pudo cambiar de proyecto. Se conserva el trabajo actual; descarga una copia como respaldo.' }
  finally { busy.value = false; projectTransition.value = false; projectChanged() }
}
function open(id: string) { return change(() => localProjects!.open(id)) }
function openCloud(id: string) {
  const owner = cloudAccount.user?.id
  return change(async () => {
    const project = await cloudTransport.get(id)
    if (!project || !owner || owner !== cloudAccount.user?.id) throw Error('Project unavailable')
    await localProjects!.openRemote(project)
  })
}
function create() {
  return change(() => localProjects!.create(JSON.stringify({ version: 6, units: 'mm', projectName: DEFAULT_PROJECT_NAME,
    room: defaultRoom(), objects: [], customObjects: [], collisions: true, structuralColor: WALL_COLOR })))
}
function duplicate() {
  const document = JSON.parse(projectJSON())
  document.projectName = (document.projectName + ' (copia)').slice(0, 120)
  return change(() => localProjects!.create(JSON.stringify(document)))
}
const emptyDocument = () => JSON.stringify({ version: 6, units: 'mm', projectName: DEFAULT_PROJECT_NAME,
  room: defaultRoom(), objects: [], customObjects: [], collisions: true, structuralColor: WALL_COLOR })
async function removeOrRestore(copies: LocalProject[], remotes: CloudProjectSummary[] = []) {
  const owner = cloudAccount.user?.id, deleted = !trash.value
  busy.value = true; error.value = ''; projectTransition.value = true; cancelCurrentSync()
  try {
    await waitForCurrentSync(); await localProjects!.flush()
    if (owner !== cloudAccount.user?.id) throw Error('La cuenta cambió. Abre la lista de nuevo.')
    const cloudCopies = copies.filter(p => p.accountId)
    for (const copy of cloudCopies) {
      const current = await cloudProjectState(copy.id)
      if (owner !== cloudAccount.user?.id) throw Error('La cuenta cambió.')
      if (!current || !!current.deleted_at === deleted) continue
      if (deleted && copy.baseRevision !== null && current.revision !== copy.baseRevision) throw Error('El proyecto cambió en la nube. Ábrelo y sincronízalo antes de eliminarlo.')
      await setCloudProjectDeleted(copy.id, current.revision, deleted)
    }
    for (const remote of remotes) {
      if (owner !== cloudAccount.user?.id) throw Error('La cuenta cambió.')
      await setCloudProjectDeleted(remote.id, remote.revision, deleted)
    }
    if (owner !== cloudAccount.user?.id) throw Error('La cuenta cambió.')
    await localProjects!.setDeleted(copies.map(p => p.id), deleted, emptyDocument())
    projectChanged()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : 'No se pudo completar la operación.' }
  finally { busy.value = false; projectTransition.value = false; projectChanged() }
  const message = error.value
  await show(false)
  if (message) error.value = message
}
async function toggleTrash() { trash.value = !trash.value; await show(false) }
</script>

<template>
  <button v-if="localProjects" :disabled="busy" @click="show()"><AppIcon name="open"/> Proyectos</button>
  <dialog ref="dialog" class="custom-library-dialog local-projects-dialog" aria-labelledby="local-projects-title" @keydown.stop>
    <div class="custom-library-heading"><h2 id="local-projects-title">Proyectos</h2><button aria-label="Cerrar proyectos" :disabled="busy" @click="dialog?.close()"><AppIcon name="close"/></button></div>
    <p class="muted">{{trash?'Los proyectos eliminados se pueden restaurar.':cloudAccount.user?'Proyectos de tu cuenta y de este dispositivo.':'Guardados en este dispositivo.'}}</p>
    <div class="project-actions"><template v-if="!trash"><button class="primary" :disabled="busy" @click="create"><AppIcon name="plus"/> Nuevo proyecto</button><button :disabled="busy" @click="duplicate"><AppIcon name="duplicate"/> Duplicar actual</button></template><button :disabled="busy" @click="toggleTrash"><AppIcon :name="trash?'back':'trash'"/> {{trash?'Volver a proyectos':'Papelera'}}</button></div>
    <p v-if="error" role="alert">{{error}}</p>
    <div class="local-project-list">
      <div v-for="row in rows" :key="row.project.id" class="project-entry"><div class="project-row">
        <button class="project-open" :disabled="busy || trash" :aria-current="row.project.id===localProjects?.current().id?'true':undefined" @click="open(row.project.id)">
          <span>{{name(row.project)}}<small>{{row.copies.some(p=>p.accountId)?'En mi cuenta':'En este dispositivo'}}{{row.project.conflict?' · Requiere revisión':row.project.recoveredFrom?' · Copia recuperada':''}}</small></span>
          <span class="muted">{{new Date(row.project.updatedAt).toLocaleString('es-ES')}}<small v-if="row.project.id===localProjects?.current().id">Actual</small></span>
        </button>
        <button class="project-delete" :disabled="busy" :aria-label="(trash?'Restaurar ':'Eliminar ')+name(row.project)" :title="trash?'Restaurar proyecto':'Eliminar proyecto'" @click="removeOrRestore(row.copies,remoteVersions(name(row.project)))"><AppIcon :name="trash?'back':'trash'"/></button>
      </div><details v-if="row.versions.length>1 || remoteVersions(name(row.project)).length" class="project-versions"><summary>Otras versiones ({{row.versions.length-1+remoteVersions(name(row.project)).length}})</summary><p class="muted">Estas versiones tienen cambios distintos o proceden de otra copia. Puedes abrirlas para revisarlas.</p><button v-for="version in row.versions.slice(1)" :key="version.id" :disabled="busy || trash" @click="open(version.id)">{{version.accountId?'En mi cuenta':'En este dispositivo'}}{{version.recoveredFrom?' · Copia recuperada':''}} · {{new Date(version.updatedAt).toLocaleString('es-ES')}}</button><button v-for="version in remoteVersions(name(row.project))" :key="version.id" :disabled="busy || trash" @click="openCloud(version.id)">En mi cuenta · {{new Date(version.updatedAt).toLocaleString('es-ES')}}</button></details></div>
      <div v-for="group in remoteRows" :key="group[0]!.id" class="project-entry"><div class="project-row">
        <template v-for="project in group.slice(0,1)" :key="project.id">
        <button class="project-open" :disabled="busy || trash" @click="openCloud(project.id)"><span>{{project.name}}<small>En mi cuenta</small></span><span class="muted">{{new Date(project.updatedAt).toLocaleString('es-ES')}}</span></button>
        <button class="project-delete" :disabled="busy" :aria-label="(trash?'Restaurar ':'Eliminar ')+project.name" @click="removeOrRestore([],group)"><AppIcon :name="trash?'back':'trash'"/></button>
        </template></div><details v-if="group.length>1" class="project-versions"><summary>Otras versiones ({{group.length-1}})</summary><button v-for="version in group.slice(1)" :key="version.id" :disabled="busy || trash" @click="openCloud(version.id)">En mi cuenta · {{new Date(version.updatedAt).toLocaleString('es-ES')}}</button></details></div>
      <p v-if="!rows.length && !remoteProjects.length" class="muted">{{trash?'La papelera está vacía.':'No hay proyectos guardados.'}}</p>
    </div>
  </dialog>
</template>

<style scoped>
.local-projects-dialog { width: min(640px, calc(100vw - 32px)); }
.project-actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.local-project-list { display: grid; gap: 8px; }
.project-row { display: flex; gap: 8px; align-items: stretch; }
.local-project-list .project-open { display: flex; flex: 1; min-width: 0; justify-content: space-between; gap: 16px; text-align: left; padding: 14px; }
.project-open>span { overflow-wrap: anywhere; }
.project-delete { flex: 0 0 44px; padding: 10px; }
.project-versions { padding: 8px 14px; font-size: 12px; }
.project-versions summary { cursor: pointer; color: #b8c3ce; }
.project-versions button { display: block; margin-top: 8px; width: 100%; text-align: left; }
.project-open:disabled { opacity: 1; }
.local-project-list button[aria-current="true"] { border-color: #70d0dc; }
.local-project-list small { display: block; margin-top: 4px; }
.local-project-list .muted { text-align: right; }
</style>
