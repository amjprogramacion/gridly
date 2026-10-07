import { createClient } from '@supabase/supabase-js'
import type { CloudTransport, RemoteProject, SaveResult } from './cloudSync.ts'
import { cloudDocument } from './localProjects.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const emailMode = import.meta.env.VITE_AUTH_EMAIL_MODE === 'otp' ? 'otp' : 'magiclink'
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : undefined

function remote(value: { id: string; document: unknown; revision: number; updated_at: string }): RemoteProject {
  if (!Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.id !== 'string' || !Number.isFinite(Date.parse(value.updated_at))) throw Error('Invalid remote project')
  return { id: value.id, document: cloudDocument(JSON.stringify(value.document)), revision: value.revision, updatedAt: value.updated_at }
}
export const cloudTransport: CloudTransport = {
  async get(id) {
    if (!supabase) throw Error('Cloud not configured')
    const { data, error } = await supabase.from('gridly_projects').select('id,document,revision,updated_at').eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? remote(data) : undefined
  },
  async save(id, operation) {
    if (!supabase) throw Error('Cloud not configured')
    const { data, error } = await supabase.rpc('gridly_save_project', {
      p_project_id: id, p_expected_revision: operation.baseRevision,
      p_operation_id: operation.id, p_document: JSON.parse(operation.document),
    })
    if (error) throw error
    if (data?.status === 'saved' && Number.isSafeInteger(data.revision) && data.revision > 0 && Number.isFinite(Date.parse(data.updated_at))) return { status: 'saved', revision: data.revision, updatedAt: data.updated_at }
    if (data?.status === 'conflict') {
      const project = remote({ ...data, id })
      return { status: 'conflict', ...project }
    }
    if (data?.status === 'missing') return { status: 'missing' }
    throw Error('Invalid save response')
  },
}
export interface CloudProjectSummary { id: string; name: string; revision: number; updatedAt: string }
export async function listCloudProjects(deleted = false): Promise<CloudProjectSummary[]> {
  if (!supabase) return []
  let query = supabase.from('gridly_projects').select('id,revision,updated_at,name:document->>projectName')
  query = deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []).map(p => ({ id: p.id, name: p.name, revision: p.revision, updatedAt: p.updated_at }))
}
export async function cloudProjectState(id: string) {
  if (!supabase) throw Error('Cloud not configured')
  const { data, error } = await supabase.from('gridly_projects').select('revision,deleted_at').eq('id',id).maybeSingle()
  if (error) throw error
  return data
}
export async function setCloudProjectDeleted(id: string, revision: number, deleted: boolean): Promise<number> {
  if (!supabase) throw Error('Cloud not configured')
  const { data, error } = await supabase.rpc('gridly_set_project_deleted', { p_project_id: id, p_expected_revision: revision, p_deleted: deleted })
  if (error) throw Error('No se pudo eliminar o restaurar el proyecto. Comprueba tu conexión.')
  if (data?.status === 'conflict') throw Error('El proyecto cambió en otro dispositivo. Actualiza la lista antes de eliminarlo.')
  if (data?.status !== 'saved' || !Number.isSafeInteger(data.revision)) throw Error('Invalid deletion response')
  return data.revision
}
