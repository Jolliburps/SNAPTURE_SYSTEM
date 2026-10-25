import { useEffect, useState } from 'react'
import { api, message, prettyTimestamp } from '../lib/api'
import type { MobileActivity } from '../lib/api'

interface ConnectionStatus {
  checked_at: string
  database: { connected: boolean; engine: string }
  django_admin_url: string | null
  content: Record<string, { published: number; draft: number }>
  schedules: number
  mobile_activity: MobileActivity
  sync: string
  privacy: string
}

export default function SystemConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api<ConnectionStatus>('integration/')
      .then(result => { if (active) { setStatus(result); setError('') } })
      .catch(reason => { if (active) { setStatus(null); setError(message(reason)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  return <section className="panel profile-panel" aria-label="Connected system">
    <h2>Connected system</h2>
    <p className="muted">The user app, CESD panel and Django admin use one backend and database. Published content is shared; private user records keep their access restrictions.</p>
    {loading && <p role="status">Checking connection…</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {status && <>
      <p className={status.database.connected ? 'notice' : 'notice notice--error'} role="status">{status.database.connected ? 'Shared database is connected.' : 'Database connection unavailable.'} Last checked: {prettyTimestamp(status.checked_at)}</p>
      <div className="form-grid">{Object.entries(status.content).map(([kind, count]) => <p key={kind}><strong>{kind.charAt(0).toUpperCase() + kind.slice(1)}</strong><br />{count.published} published · {count.draft} draft</p>)}</div>
      <p>{status.schedules} collection schedules · {status.mobile_activity.scans} saved user scans · {status.mobile_activity.projects_started} user projects</p>
      <p className="muted">{status.sync}</p><p className="muted">{status.privacy}</p>
      {status.django_admin_url && <p><a className="text-link" href={status.django_admin_url} target="_blank" rel="noopener noreferrer">Open Django administration ↗</a><br /><small>Your existing permissions apply. Manage staff accounts in Staff Access; recommendation-rule review requires separate permission.</small></p>}
    </>}
    <button type="button" className="secondary-button" disabled={loading} onClick={() => { setLoading(true); setStatus(null); setError(''); setRevision(value => value + 1) }}>{loading ? 'Checking…' : 'Refresh connection'}</button>
  </section>
}
