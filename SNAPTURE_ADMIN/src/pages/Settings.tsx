import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Ban, LockKeyhole, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PageHeading } from '../components/ui'
import { Badge, EmptyState, Modal, Pagination } from '../components/ManagementUI'
import { api, message, prettyDate } from '../lib/api'
import type { Page, StaffUser } from '../lib/api'

function Profile() {
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState(user!.email)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    try { await api('me/', { method: 'PATCH', body: JSON.stringify(data) }); await refresh(); setNotice('Your profile has been updated.'); const password = form.querySelector<HTMLInputElement>('[name=current_password]'); if (password) password.value = '' }
    catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  async function requestPassword() {
    setBusy(true); setError(''); setNotice('')
    try { setNotice((await api<{ detail: string }>('password/request/', { method: 'POST', body: JSON.stringify({ email: user!.email }) })).detail) }
    catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <section className="panel profile-panel"><h2>Profile Information</h2><form className="record-form" onSubmit={save}>
    <label>Full Name<input name="name" defaultValue={user!.name} maxLength={120} required autoComplete="name" /></label>
    <label>Email Address<input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
    {email !== user!.email && <label>Current Password<input name="current_password" type="password" autoComplete="current-password" required /><small>Confirm your identity to change your email address.</small></label>}
    <div className="form-grid"><label>Department<input value={user!.department} disabled /></label><label>Account Access<input value={user!.access === 'owner' ? 'Account Owner' : 'Staff'} disabled /></label></div>
    {error && <p className="notice notice--error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="form-actions"><button type="button" className="text-link" disabled={busy} onClick={requestPassword}>Change password</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button></div>
  </form></section>
}

interface ActivityRow { id: number; actor: string; action: string; record_type: string; record_id: string; record_label: string; timestamp: string }

function StaffAccess() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [activity, setActivity] = useState<Page<ActivityRow>>({ results: [], count: 0, pages: 1, page: 1 })
  const [activityPage, setActivityPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<StaffUser | 'new' | null>(null)
  const [toggle, setToggle] = useState<StaffUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize loading with the new remote query.
    setLoading(true)
    Promise.all([api<{ results: StaffUser[] }>('staff/'), api<Page<ActivityRow>>(`activity/?page=${activityPage}`)])
      .then(([people, log]) => { if (active) { setStaff(people.results); setActivity(log); setError('') } })
      .catch((error) => { if (active) setError(message(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision, activityPage])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFormError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ detail: string }>(editor === 'new' ? 'staff/' : `staff/${(editor as StaffUser).id}/`, { method: editor === 'new' ? 'POST' : 'PATCH', body: JSON.stringify(data) })
      setNotice(result.detail); setEditor(null); setActivityPage(1); setRevision((v) => v + 1)
    } catch (error) { setFormError(message(error)) } finally { setBusy(false) }
  }
  async function changeStatus() {
    if (!toggle) return
    setBusy(true); setFormError('')
    try {
      await api(`staff/${toggle.id}/`, { method: 'PATCH', body: JSON.stringify({ ...toggle, status: toggle.status === 'Active' ? 'Deactivated' : 'Active' }) })
      setNotice(`${toggle.name}'s account has been ${toggle.status === 'Active' ? 'deactivated' : 'activated'}.`); setToggle(null); setActivityPage(1); setRevision((v) => v + 1)
    } catch (error) { setFormError(message(error)) } finally { setBusy(false) }
  }
  const selected = editor && editor !== 'new' ? editor : null
  return <>
    <div className="section-toolbar"><span className="muted">Individual CESD accounts</span><button className="primary-button" onClick={() => { setEditor('new'); setFormError('') }}><Plus size={16} />Add Staff Account</button></div>
    {error && <p className="notice notice--error" role="alert">{error} <button className="text-link" onClick={() => setRevision((v) => v + 1)}>Retry</button></p>}{notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel table-panel" aria-label="Staff accounts"><div className="table-scroll"><table className="management-table"><thead><tr><th>Staff Member</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {staff.map((person, i) => <tr key={person.id}><td><div className="person"><span className={`avatar avatar--${i % 4}`}>{person.name.charAt(0)}</span><div><strong>{person.name}{person.id === user!.id ? ' (You)' : ''}</strong><small>{person.email}</small>{person.setup_pending && <small className="pending-label">Password setup pending</small>}</div></div></td><td>{person.access === 'owner' ? 'Account Owner' : 'Staff'}</td><td><Badge status={person.status} /></td><td>{person.access === 'owner' ? <span className="muted">—</span> : <div className="row-actions"><button className="row-button" aria-label={`Edit ${person.name}`} onClick={() => { setEditor(person); setFormError('') }}><Pencil size={15} /></button><button className={`row-button ${person.status === 'Active' ? 'row-button--danger' : 'row-button--green'}`} aria-label={`${person.status === 'Active' ? 'Deactivate' : 'Activate'} ${person.name}`} onClick={() => { setToggle(person); setFormError('') }}>{person.status === 'Active' ? <Ban size={15} /> : <RotateCcw size={15} />}</button></div>}</td></tr>)}
    </tbody></table></div>{staff.length === 0 && <EmptyState loading={loading} label="No staff accounts available." />}</section>
    <section className="panel activity-panel"><h2>Account Activity</h2><div className="table-scroll"><table className="management-table"><thead><tr><th>Date &amp; Time</th><th>Staff Member</th><th>Action</th><th>Affected Record</th></tr></thead><tbody>{activity.results.map((row) => <tr key={row.id}><td>{prettyDate(row.timestamp)}<small>{new Date(row.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}</small></td><td>{row.actor}</td><td>{row.action}</td><td>{row.record_label}<small>{row.record_type} #{row.record_id}</small></td></tr>)}</tbody></table></div>{!activity.results.length && <EmptyState loading={loading} label="No account activity yet." />}<Pagination page={activityPage} pages={activity.pages} count={activity.count} onPage={setActivityPage} /></section>
    {editor && <Modal title={editor === 'new' ? 'Add Staff Account' : 'Edit Staff Account'} onClose={() => { if (!busy) setEditor(null) }}><form className="record-form" onSubmit={save}><label>Full Name<input name="name" defaultValue={selected?.name} maxLength={120} required /></label><label>Email Address<input name="email" type="email" defaultValue={selected?.email} required /></label><div className="form-grid"><label>Department<input name="department" defaultValue={selected?.department || 'CESD Bacoor'} maxLength={120} required /></label><label>Account Access<input value="Staff" disabled /></label></div><label>Status<select name="status" defaultValue={selected?.status || 'Active'}><option>Active</option><option>Deactivated</option></select></label><p className="muted">New staff members receive an individual password setup link. Changing an email requires a new password setup.</p>{formError && <p className="notice notice--error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save Account'}</button></div></form></Modal>}
    {toggle && <Modal title={`${toggle.status === 'Active' ? 'Deactivate' : 'Activate'} staff account`} onClose={() => { if (!busy) setToggle(null) }}><p className="dialog-copy">{toggle.status === 'Active' ? `Deactivate ${toggle.name}? Their active sessions will end and they will be unable to sign in.` : `Restore sign-in access for ${toggle.name}?`}</p>{formError && <p className="notice notice--error" role="alert">{formError}</p>}<div className="form-actions"><button className="secondary-button" disabled={busy} onClick={() => setToggle(null)}>Cancel</button><button className="primary-button" disabled={busy} onClick={changeStatus}>{busy ? 'Saving…' : 'Confirm'}</button></div></Modal>}
  </>
}

export default function Settings() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'profile' | 'staff'>('profile')
  return <><PageHeading title="Settings" description={user?.access === 'owner' ? 'Manage your account settings and staff access.' : 'Manage your account settings.'} /><div className="settings-tabs" role="tablist" aria-label="Settings"><button id="profile-tab" role="tab" aria-selected={tab === 'profile'} aria-controls="settings-content" onClick={() => setTab('profile')}>My Profile</button>{user?.access === 'owner' && <><button id="staff-tab" role="tab" aria-selected={tab === 'staff'} aria-controls="settings-content" onClick={() => setTab('staff')}>Staff Access</button><span className="owner-label"><LockKeyhole size={15} />Owner only</span></>}</div><div id="settings-content" role="tabpanel" aria-labelledby={tab === 'profile' ? 'profile-tab' : 'staff-tab'}>{tab === 'staff' && user?.access === 'owner' ? <StaffAccess /> : <Profile />}</div></>
}
