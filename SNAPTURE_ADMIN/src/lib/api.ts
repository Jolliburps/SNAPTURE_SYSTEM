let csrf = ''
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method || 'GET'
  if (method !== 'GET' && !csrf) {
    const response = await fetch('/api/cesd/csrf/', { credentials: 'same-origin' })
    if (!response.ok) throw new ApiError('The CESD API is unavailable. Start the local Django server.', response.status)
    csrf = (await response.json()).csrf
  }
  const headers = new Headers(init.headers)
  if (method !== 'GET') headers.set('X-CSRFToken', csrf)
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  let response: Response
  try { response = await fetch(`/api/cesd/${path}`, { ...init, headers, credentials: 'same-origin' }) }
  catch { throw new ApiError('Cannot reach the CESD API. Check that the local Django server is running.', 0) }
  const data = await response.json().catch(() => ({ detail: 'The API is unavailable or returned an unexpected response.' }))
  if (!response.ok) {
    if (response.status === 401 && path !== 'login/') window.dispatchEvent(new Event('cesd-session-ended'))
    if (response.status === 403) csrf = ''
    throw new ApiError(data.detail || 'The request could not be completed.', response.status)
  }
  if (data.csrf) csrf = data.csrf
  return data as T
}

export function message(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }
export interface StaffUser { id: number; name: string; email: string; department: string; access: 'owner' | 'staff'; status: 'Active' | 'Deactivated'; setup_pending: boolean }
export type Resource = 'policies' | 'materials' | 'schedules' | 'announcements'
export interface SavedRecord {
  id: number; title?: string; category?: string; description?: string; content?: string; effective_date?: string
  material_type?: string; file_url?: string | null; waste_type?: string; barangay?: string; collection_date?: string
  start_time?: string; end_time?: string; notes?: string; day?: string
  status: string; updated_by: string; created_at: string; updated_at: string; type?: Resource
}
export interface Page<T> { results: T[]; count: number; pages: number; page: number }
export interface Metadata { barangays: string[]; categories: { policies: string[]; materials: string[]; announcements: string[] } }
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function prettyDate(value?: string, weekday = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', ...(weekday ? { weekday: 'short' as const } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00+08:00` : value))
}
export function timeLabel(value?: string) {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}
export function prettyTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

export interface MobileActivity { scans: number; items: number; projects_started: number; projects_active: number; projects_completed: number }
