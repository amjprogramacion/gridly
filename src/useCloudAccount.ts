import { computed, reactive, watch } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase, cloudTransport, emailMode } from './supabaseClient.ts'
import { currentProject, localProjects, projectTransition, publishProject } from './useLocalProjects.ts'
import { cloudDocument } from './localProjects.ts'
import { createCloudSync, type SyncStatus } from './cloudSync.ts'
import { parseProject, projectJSON, customEditing } from './editor.ts'

export const cloudAccount = reactive({
  configured: !!supabase, ready: false, user: null as { id: string; email: string } | null,
  status: 'local' as SyncStatus, message: '', authError: '', busy: false,
})
export const projectCloudStatus = computed(() => cloudAccount.user && currentProject.value?.accountId === cloudAccount.user.id
  ? ({ local: 'Guardado local', pending: 'Cambios pendientes', syncing: 'Sincronizando…', synced: 'Sincronizado', offline: 'Sin conexión', conflict: 'Requiere revisión', error: 'No se pudo sincronizar' }[cloudAccount.status])
  : 'En este dispositivo')
let sync: ReturnType<typeof createCloudSync> | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let interaction = false
let authQueue = Promise.resolve()
let authGeneration = 0
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | undefined
function canApply() {
  return !interaction && !projectTransition.value && !customEditing.value &&
    !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') && !document.querySelector('dialog[open]')
}
function schedule() {
  if (timer) clearTimeout(timer)
  if (!cloudAccount.user || projectTransition.value) return
  timer = setTimeout(() => { void synchronize() }, 1200)
}
export async function synchronize() {
  if (!sync || projectTransition.value || interaction) { schedule(); return }
  await sync.sync(); publishProject()
  if (cloudAccount.status === 'pending' && localProjects?.current().pending) schedule()
}
export function cancelCurrentSync() { sync?.cancel() }
export async function waitForCurrentSync() { await sync?.idle() }
export function projectChanged() {
  publishProject(); cloudAccount.message = ''
  const project = localProjects?.current()
  cloudAccount.status = project?.accountId ? project.conflict ? 'conflict' : project.pending ? 'pending' : 'synced' : 'local'
  schedule()
}
async function transition(session: Session | null, generation: number) {
  if (!localProjects || generation !== authGeneration) return
  const next = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null
  if (cloudAccount.ready && next?.id === cloudAccount.user?.id) return
  projectTransition.value = true
  try {
    await localProjects.setAccount(next?.id ?? null)
    if (generation !== authGeneration) return
    cloudAccount.user = next; cloudAccount.ready = true; cloudAccount.status = 'local'; cloudAccount.message = ''
    publishProject()
    if (channel && supabase) await supabase.removeChannel(channel)
    if (next && supabase) {
      channel = supabase.channel(`gridly:${next.id}`).on('postgres_changes', {
        event: '*', schema: 'public', table: 'gridly_projects', filter: `owner_id=eq.${next.id}`,
      }, schedule).subscribe()
    }
  } catch {
    cloudAccount.authError = 'No se pudo abrir el almacenamiento de esta cuenta. Tu trabajo local se conserva.'
    cloudAccount.user = null
  } finally { projectTransition.value = false; schedule() }
}
function enqueue(session: Session | null) {
  const generation = ++authGeneration
  sync?.cancel()
  authQueue = authQueue.then(() => transition(session, generation))
}
export async function initializeCloudAccount() {
  if (!supabase || !localProjects) { cloudAccount.ready = true; return }
  sync = createCloudSync({
    current: () => localProjects!.current(), flush: () => localProjects!.flush(),
    revise: async transform => { const result = await localProjects!.revise(transform); publishProject(); return result },
  }, cloudTransport, {
    account: () => cloudAccount.user?.id ?? null,
    validate: document => { parseProject(document) }, canApply,
    status: (status, message = '') => { cloudAccount.status = status; cloudAccount.message = message },
  })
  supabase.auth.onAuthStateChange((_event, session) => { queueMicrotask(() => enqueue(session)) })
  const { data, error } = await supabase.auth.getSession()
  if (error) cloudAccount.authError = 'No se pudo recuperar la sesión. Puedes iniciar sesión de nuevo.'
  enqueue(data.session)
  await authQueue
  watch(currentProject, schedule)
  window.addEventListener('online', schedule)
  window.addEventListener('offline', () => { if (localProjects?.current().accountId) cloudAccount.status = 'offline' })
  window.addEventListener('focus', schedule)
  window.addEventListener('pointerdown', () => { interaction = true }, true)
  const finish = () => { interaction = false; schedule() }
  window.addEventListener('pointerup', finish, true)
  window.addEventListener('pointercancel', finish, true)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule() })
  // A lost Realtime connection cannot be the only way to discover updates.
  setInterval(() => { if (!document.hidden && cloudAccount.user) schedule() }, 30000)
  schedule()
}
export async function requestSignIn(email: string) {
  if (!supabase) throw Error('Cloud not configured')
  cloudAccount.authError = ''
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin + '/' } })
  if (error) throw Error('No se pudo enviar el correo de acceso. Comprueba la dirección y vuelve a intentarlo; el envío de desarrollo puede estar restringido.')
}
export async function verifyCode(email: string, token: string) {
  if (!supabase) throw Error('Cloud not configured')
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
  if (error) throw Error('El código no es válido o ha caducado. Solicita uno nuevo.')
}
export async function signOut() {
  if (!supabase || !localProjects) return
  await localProjects.flush()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw Error('No se pudo cerrar sesión. Vuelve a intentarlo.')
}
export async function uploadLocalProject() {
  if (!localProjects || !cloudAccount.user) throw Error('Inicia sesión para guardar en tu cuenta.')
  if (localProjects.current().accountId === cloudAccount.user.id) return synchronize()
  projectTransition.value = true; sync?.cancel()
  try { await localProjects.create(projectJSON(), cloudAccount.user.id); publishProject() }
  finally { projectTransition.value = false }
  await synchronize()
}
export async function resolveCloudConflict(useCloud: boolean) {
  if (!localProjects || !cloudAccount.user) return
  await localProjects.flush()
  const original = localProjects.current(), conflict = original.conflict
  if (!conflict) return
  projectTransition.value = true; sync?.cancel()
  try {
    // Always preserve the complete local scene and workshop draft as a new copy.
    const copy = JSON.parse(original.document)
    copy.projectName = (copy.projectName + ' (copia)').slice(0, 120)
    await localProjects.create(JSON.stringify(copy))
    await localProjects.open(original.id)
    await localProjects.revise(p => ({ ...p, document: conflict.document, conflict: undefined, outbox: undefined,
        baseRevision: conflict.revision, syncedDocument: cloudDocument(conflict.document), pending: false }))
    if (!useCloud) await localProjects.create(JSON.stringify(copy), cloudAccount.user.id)
    publishProject()
  } finally { projectTransition.value = false }
  await synchronize()
}
export { emailMode }
