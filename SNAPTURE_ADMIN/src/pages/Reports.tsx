import { useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, CalendarDays, Download, Eye, FileText } from 'lucide-react'
import { IconTile, PageHeading } from '../components/ui'
import { Badge, EmptyState, Pagination } from '../components/ManagementUI'
import { RecordPreview } from './ContentManager'
import { api, localDate, message, prettyDate } from '../lib/api'
import MobileActivitySummary from '../components/MobileActivitySummary'
import type { MobileActivity, Page, Resource, SavedRecord } from '../lib/api'

interface ReportData extends Page<SavedRecord> { mobile_activity: MobileActivity; counts: Record<string, number | Record<string, number>> }
interface ReportFilter { start: string; end: string; type: string }
const labels = { announcements: 'Announcements', policies: 'Policies', materials: 'Educational Materials', schedules: 'Collection Schedules' }

export default function Reports() {
  const today = localDate()
  const [filter, setFilter] = useState<ReportFilter>({ start: today.slice(0, 7) + '-01', end: today, type: 'all' })
  const [generated, setGenerated] = useState<ReportFilter | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<SavedRecord | null>(null)
  const [exporting, setExporting] = useState(false)
  const dirty = !!generated && JSON.stringify(filter) !== JSON.stringify(generated)
  async function generate(event?: FormEvent, page = 1, selection = filter) {
    event?.preventDefault(); setLoading(true); setError('')
    try {
      const result = await api<ReportData>(`reports/?${new URLSearchParams({ ...selection, page: String(page) })}`)
      setData(result); setGenerated({ ...selection })
    } catch (error) { setError(message(error)) } finally { setLoading(false) }
  }
  async function exportCsv() {
    if (!generated) return
    setExporting(true); setError('')
    try {
      const response = await fetch(`/api/cesd/reports/?${new URLSearchParams({ ...generated, format: 'csv' })}`, { credentials: 'same-origin' })
      if (!response.ok) { const result = await response.json(); if (response.status === 401) window.dispatchEvent(new Event('cesd-session-ended')); throw new Error(result.detail || 'CSV export failed.') }
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `snapture-${generated.type}-${generated.start}-${generated.end}.csv`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(message(error)) } finally { setExporting(false) }
  }
  return <><PageHeading title="Reports" description="Generate and view reports on saved content and collection schedules." />
    <form className="report-controls" onSubmit={(event) => generate(event)}><label>From<input type="date" value={filter.start} onChange={(event) => setFilter((v) => ({ ...v, start: event.target.value }))} max={filter.end} required /></label><label>To<input type="date" value={filter.end} onChange={(event) => setFilter((v) => ({ ...v, end: event.target.value }))} min={filter.start} required /></label><label>Report Type<select value={filter.type} onChange={(event) => setFilter((v) => ({ ...v, type: event.target.value }))}><option value="all">All Report Types</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="primary-button" disabled={loading}>{loading ? 'Generating…' : 'Generate Report'}</button><button className="secondary-button" type="button" onClick={exportCsv} disabled={!data || loading || dirty || exporting}><Download size={16} />{exporting ? 'Exporting…' : 'Export CSV'}</button></form>
    <p className="report-note">Policies, materials, and announcements use the last-updated date. Schedules use the collection date. Dates and times follow Bacoor local time.</p>
    {error && <p className="notice notice--error" role="alert">{error}</p>}{dirty && <p className="notice" role="status">Filters changed. Generate the report to update the results.</p>}
    {data && <><div className="report-summary">{(['policies', 'materials', 'schedules', 'announcements'] as Resource[]).map((type) => <section className="stat-card" key={type}><IconTile icon={type === 'policies' ? FileText : type === 'materials' ? BookOpen : CalendarDays} tone={type === 'policies' ? 'blue' : type === 'materials' ? 'amber' : 'green'} /><div><strong>{String(data.counts[type])}</strong><span>{labels[type]}</span><small>{Object.entries(data.counts[type + '_statuses'] as Record<string, number>).map(([status, count]) => `${count} ${status}`).join(' · ')}</small></div></section>)}</div><p className="report-note">Summary includes all content and schedule record types in the generated date range. The table and CSV use the selected report type.</p></>}
    {data && <MobileActivitySummary data={data.mobile_activity} />}
    <section className="panel report-panel"><h2>Reports</h2>{generated && <p className="report-note">{prettyDate(generated.start)} – {prettyDate(generated.end)} · {generated.type === 'all' ? 'All report types' : labels[generated.type as Resource]}</p>}
      {data?.results.length ? <div className="table-scroll"><table className="management-table"><thead><tr><th>Record</th><th>Type</th><th>Date</th><th>Status</th><th>Responsible Staff</th><th>Actions</th></tr></thead><tbody>{data.results.map((row) => <tr key={`${row.type}-${row.id}`}><td><strong>{row.title || `${row.waste_type} · ${row.barangay}`}</strong></td><td>{labels[row.type!]}</td><td>{prettyDate(row.collection_date || row.updated_at)}</td><td><Badge status={row.status} /></td><td>{row.updated_by}</td><td><button className="row-button" aria-label={`View ${row.title || row.waste_type + ' schedule'}`} onClick={() => setPreview(row)}><Eye size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState loading={loading} label={data ? 'No saved records match this report.' : 'Choose a date range and generate a report to view saved records.'} />}
      {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={(page) => { if (generated) void generate(undefined, page, generated) }} />}
    </section>{preview && <RecordPreview record={preview} resource={preview.type!} onClose={() => setPreview(null)} />}
  </>
}
