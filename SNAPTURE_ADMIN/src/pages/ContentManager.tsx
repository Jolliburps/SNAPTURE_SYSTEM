import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Eye, FileImage, FileText, Leaf, Pencil, Play, Plus, Recycle, Search, Trash2 } from 'lucide-react'
import { PageHeading } from '../components/ui'
import { Badge, EmptyState, Modal, Pagination } from '../components/ManagementUI'
import { api, localDate, message, prettyDate, prettyTimestamp, timeLabel } from '../lib/api'
import type { Metadata, Page, Resource, SavedRecord } from '../lib/api'

const config = {
  announcements: { title: 'Announcements', description: 'Publish local updates to the mobile Home screen.', singular: 'Announcement', search: 'Search announcements...' },
  policies: { title: 'Policies & Guidelines', description: 'Manage waste management policies, guidelines, and ordinances.', singular: 'Policy', search: 'Search policies…' },
  materials: { title: 'Educational Materials', description: 'Manage educational materials for waste management awareness.', singular: 'Material', search: 'Search materials…' },
  schedules: { title: 'Collection Schedule', description: 'Manage waste collection schedules per barangay.', singular: 'Schedule', search: 'Search schedules…' },
}
const materialTypes = ['Infographic', 'PDF Guide', 'Video']
const wasteTypes = ['Recyclable', 'Biodegradable', 'Residual']
const accepts: Record<string, string> = { 'PDF Guide': '.pdf', Infographic: '.png,.jpg,.jpeg,.webp', Video: '.mp4,.webm' }
const limits: Record<string, number> = { 'PDF Guide': 20, Infographic: 10, Video: 100 }

export function RecordPreview({ record, resource, onClose }: { record: SavedRecord; resource: Resource; onClose: () => void }) {
  return <Modal title={resource === 'schedules' ? `${record.waste_type} collection` : record.title || 'Record details'} onClose={onClose}><div className="record-preview"><Badge status={record.status} />
    {resource === 'schedules' ? <dl className="detail-grid"><div><dt>Barangay</dt><dd>{record.barangay}</dd></div><div><dt>Collection Date</dt><dd>{prettyDate(record.collection_date, true)}</dd></div><div><dt>Time</dt><dd>{timeLabel(record.start_time)} – {timeLabel(record.end_time)}</dd></div><div><dt>Notes</dt><dd>{record.notes || 'No additional notes.'}</dd></div></dl> : <><dl className="detail-grid"><div><dt>Category</dt><dd>{record.category}</dd></div><div><dt>{resource === 'policies' ? 'Effective Date' : 'Content Type'}</dt><dd>{resource === 'policies' ? prettyDate(record.effective_date) : record.material_type || 'Announcement'}</dd></div></dl><p className="preserve-lines">{record.description}</p>{record.content && <div className="policy-content preserve-lines">{record.content}</div>}
      {record.file_url && <div className="attachment-preview">{record.material_type === 'Infographic' ? <img src={record.file_url} alt={record.title} /> : record.material_type === 'Video' ? <video controls preload="metadata" src={record.file_url}><track kind="captions" /></video> : <iframe src={record.file_url} title={`${record.title} PDF preview`} />}<a className="text-link" href={record.file_url} target="_blank" rel="noreferrer">Open attachment in a new tab</a></div>}</>}
    <div className="record-attribution">Updated {prettyTimestamp(record.updated_at)} by {record.updated_by}<br />Created {prettyTimestamp(record.created_at)} · Bacoor local time</div></div></Modal>
}

function RecordEditor({ resource, record, metadata, onClose, onSaved }: { resource: Resource; record: SavedRecord | null; metadata: Metadata; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [materialType, setMaterialType] = useState(record?.material_type || 'Infographic')
  const [date, setDate] = useState(record?.collection_date || localDate())
  const kind = resource === 'policies' ? 'PDF Guide' : materialType
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    const file = data.get('attachment')
    if (file instanceof File && file.size) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!accepts[kind].split(',').includes(extension) || file.size > limits[kind] * 1024 * 1024) { setError(`Choose ${accepts[kind]} files up to ${limits[kind]} MB.`); return }
    } else data.delete('attachment')
    setBusy(true)
    try { await api(`${resource}/${record ? `${record.id}/` : ''}`, { method: 'POST', body: data }); onSaved() }
    catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  const close = () => { if (!busy) onClose() }
  return <Modal title={`${record ? 'Edit' : 'Add'} ${config[resource].singular}`} onClose={close}><form className="record-form" onSubmit={submit}>
    {resource === 'schedules' ? <>
      <div className="form-grid"><label>Waste Type<select name="waste_type" defaultValue={record?.waste_type || 'Recyclable'}>{wasteTypes.map((v) => <option key={v}>{v}</option>)}</select></label><label>Barangay<select name="barangay" defaultValue={record?.barangay || ''} required><option value="" disabled>Select barangay</option>{metadata.barangays.map((v) => <option key={v}>{v}</option>)}</select></label></div>
      <label>Collection Date<input name="collection_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><small>{date ? prettyDate(date, true) : 'Choose a collection date'}</small></label>
      <div className="form-grid"><label>Start Time<input name="start_time" type="time" defaultValue={record?.start_time || '08:00'} required /></label><label>End Time<input name="end_time" type="time" defaultValue={record?.end_time || '12:00'} required /></label></div>
      <label>Notes (optional)<textarea name="notes" defaultValue={record?.notes} rows={3} maxLength={10000} /></label>
    </> : <>
      <label>Title<input name="title" defaultValue={record?.title} maxLength={160} required /></label>
      <div className="form-grid"><label>Category<input name="category" defaultValue={record?.category} maxLength={120} list="record-categories" required /><datalist id="record-categories">{[...new Set([...metadata.categories[resource], ...(resource === 'policies' ? ['Guidelines', 'Ordinance', 'Policy'] : resource === 'announcements' ? ['Announcement', 'Service update'] : ['Recycling', 'Segregation', 'Composting'])])].map((v) => <option key={v} value={v} />)}</datalist></label>
        {resource === 'policies' ? <label>Effective Date<input name="effective_date" type="date" defaultValue={record?.effective_date || localDate()} required /></label> : resource === 'materials' ? <label>Material Type<select name="material_type" value={materialType} onChange={(event) => setMaterialType(event.target.value)}>{materialTypes.map((v) => <option key={v}>{v}</option>)}</select></label> : null}
      </div>
      <label>{resource === 'policies' ? 'Short Description' : 'Description'}<textarea name="description" defaultValue={record?.description} maxLength={10000} rows={3} required /></label>
      {resource === 'policies' && <label>Policy Content<textarea name="content" defaultValue={record?.content} maxLength={100000} rows={7} required /></label>}
      {resource !== 'announcements' && <label>{record?.file_url ? 'Replace Attachment' : resource === 'policies' ? 'PDF Attachment (optional)' : 'Upload Material'}<input name="attachment" key={kind} type="file" accept={accepts[kind]} required={resource === 'materials' && (!record?.file_url || record.material_type !== materialType)} /><small>{accepts[kind]} · Maximum {limits[kind]} MB{record?.file_url ? ' · Leave empty to keep the current file.' : ''}</small></label>}
      {resource === 'policies' && record?.file_url && <label className="checkbox-label"><input name="attachment-clear" type="checkbox" />Remove current PDF attachment</label>}
    </>}
    <label>Status<select name="status" defaultValue={record?.status || (resource === 'schedules' ? 'Scheduled' : 'Draft')}>{(resource === 'schedules' ? ['Scheduled', 'Completed', 'Cancelled'] : ['Draft', 'Published']).map((v) => <option key={v}>{v}</option>)}</select></label>
    {resource !== 'schedules' && <p className="muted">Published {resource} are visible in the mobile {resource === 'announcements' ? 'Home updates' : 'reference library'}. Drafts are private to CESD personnel.</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={close}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save ' + config[resource].singular}</button></div>
  </form></Modal>
}

export default function ContentManager({ resource }: { resource: Resource }) {
  const [params, setParams] = useSearchParams()
  const editId = params.get('edit')
  const [metadata, setMetadata] = useState<Metadata>({ barangays: [], categories: { policies: [], materials: [], announcements: [] } })
  const [data, setData] = useState<Page<SavedRecord>>({ results: [], count: 0, pages: 1, page: 1 })
  const [filters, setFilters] = useState<Record<string, string>>({ search: '', status: params.get('status') || '', category: '', material_type: '', waste_type: '', barangay: '', month: resource === 'schedules' ? params.get('month') || localDate().slice(0, 7) : '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<SavedRecord | 'new' | null>(null)
  const [preview, setPreview] = useState<SavedRecord | null>(null)
  useEffect(() => {
    if (!editId) return
    let active = true
    Promise.all([api<{ record: SavedRecord }>(`${resource}/${encodeURIComponent(editId)}/`), api<Metadata>('metadata/')])
      .then(([data, meta]) => { if (active) { setMetadata(meta); setEditor(data.record) } })
      .catch((error) => { if (active) setError(message(error)) })
    return () => { active = false }
  }, [resource, editId])
  function closeEditor() {
    setEditor(null)
    if (editId) { const next = new URLSearchParams(params); next.delete('edit'); setParams(next, { replace: true }) }
  }
  useEffect(() => { const timer = setTimeout(() => { setFilters((v) => ({ ...v, search })); setPage(1) }, 250); return () => clearTimeout(timer) }, [search])
  useEffect(() => {
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize loading with the new remote query.
    setLoading(true)
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
    params.set('page', String(page))
    Promise.all([api<Page<SavedRecord>>(`${resource}/?${params}`), api<Metadata>('metadata/')])
      .then(([rows, meta]) => { if (active) { setData(rows); setMetadata(meta); setError('') } })
      .catch((error) => { if (active) setError(message(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [resource, filters, page, revision])
  function filter(name: string, value: string) { setFilters((v) => ({ ...v, [name]: value })); setPage(1) }
  const c = config[resource]
  return <><PageHeading title={c.title} description={c.description}><button className="primary-button" onClick={() => setEditor('new')}><Plus size={16} />Add {c.singular}</button></PageHeading>
    <div className="filter-bar"><label className="search-field"><Search size={17} /><input aria-label={c.search.replace('…', '')} placeholder={c.search} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {resource === 'policies' && <select aria-label="Filter by category" value={filters.category} onChange={(event) => filter('category', event.target.value)}><option value="">All Categories</option>{metadata.categories.policies.map((v) => <option key={v}>{v}</option>)}</select>}
      {resource === 'materials' && <select aria-label="Filter by material type" value={filters.material_type} onChange={(event) => filter('material_type', event.target.value)}><option value="">All Types</option>{materialTypes.map((v) => <option key={v}>{v}</option>)}</select>}
      {resource === 'schedules' && <><select aria-label="Filter by waste type" value={filters.waste_type} onChange={(event) => filter('waste_type', event.target.value)}><option value="">All Waste Types</option>{wasteTypes.map((v) => <option key={v}>{v}</option>)}</select><select aria-label="Filter by barangay" value={filters.barangay} onChange={(event) => filter('barangay', event.target.value)}><option value="">All Barangays</option>{metadata.barangays.map((v) => <option key={v}>{v}</option>)}</select><input aria-label="Filter by month" type="month" value={filters.month} onChange={(event) => filter('month', event.target.value)} /></>}
      <select aria-label="Filter by status" value={filters.status} onChange={(event) => filter('status', event.target.value)}><option value="">All Statuses</option>{(resource === 'schedules' ? ['Scheduled', 'Completed', 'Cancelled'] : ['Draft', 'Published']).map((v) => <option key={v}>{v}</option>)}</select>
    </div>
    {error && <p className="notice notice--error" role="alert">{error} <button className="text-link" onClick={() => setRevision((v) => v + 1)}>Retry</button></p>}{notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel table-panel" aria-label={c.title} aria-busy={loading}><div className="table-scroll"><table className="management-table"><thead><tr>{resource === 'schedules' ? <><th>Waste Type</th><th>Barangay</th><th>Collection Date</th><th>Time</th></> : <><th>Title</th><th>{resource !== 'materials' ? 'Category' : 'Type'}</th><th>Last Updated</th></>}<th>Status</th><th>Actions</th></tr></thead><tbody>{data.results.map((row) => {
      const Icon = resource === 'schedules' ? row.waste_type === 'Recyclable' ? Recycle : row.waste_type === 'Biodegradable' ? Leaf : Trash2 : row.material_type === 'Video' ? Play : row.material_type === 'Infographic' ? FileImage : FileText
      const tone = resource === 'schedules' ? row.waste_type === 'Residual' ? 'red' : row.waste_type === 'Biodegradable' ? 'lime' : 'green' : row.material_type === 'Video' ? 'purple' : row.material_type === 'PDF Guide' ? 'red' : 'green'
      return <tr key={row.id}>{resource === 'schedules' ? <><td><div className="record-title"><span className={`small-tile small-tile--${tone}`}><Icon size={23} /></span><strong>{row.waste_type}</strong></div></td><td>{row.barangay}</td><td>{prettyDate(row.collection_date, true)}<small>Updated by {row.updated_by}<br />{prettyDate(row.updated_at)}</small></td><td className="time-cell">{timeLabel(row.start_time)} –<br />{timeLabel(row.end_time)}</td></> : <><td><div className="record-title">{resource === 'materials' && <span className={`small-tile small-tile--${tone}`}><Icon size={23} /></span>}<strong>{row.title}</strong></div></td><td>{resource !== 'materials' ? row.category : row.material_type}</td><td>{prettyDate(row.updated_at)}<small>by {row.updated_by}</small></td></>}<td><Badge status={row.status} /></td><td><div className="row-actions"><button className="row-button" aria-label={`View ${row.title || row.waste_type + ' schedule'}`} onClick={() => setPreview(row)}><Eye size={15} /></button><button className="row-button" aria-label={`Edit ${row.title || row.waste_type + ' schedule'}`} onClick={() => setEditor(row)}><Pencil size={15} /></button></div></td></tr>
    })}</tbody></table></div>{!data.results.length && !error && <EmptyState loading={loading} />}<Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} /></section>
    {editor && <RecordEditor resource={resource} record={editor === 'new' ? null : editor} metadata={metadata} onClose={closeEditor} onSaved={() => { closeEditor(); setNotice(`${c.singular} saved successfully.`); setPage(1); setRevision((v) => v + 1) }} />}
    {preview && <RecordPreview record={preview} resource={resource} onClose={() => setPreview(null)} />}
  </>
}
