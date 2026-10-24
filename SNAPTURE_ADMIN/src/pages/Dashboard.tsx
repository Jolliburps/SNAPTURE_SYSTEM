import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BookOpen, CalendarDays, FileText, Leaf, Recycle, Trash2 } from 'lucide-react'
import { IconTile, PageHeading, Panel } from '../components/ui'
import { Badge, EmptyState } from '../components/ManagementUI'
import { api, localDate, message, prettyDate, timeLabel } from '../lib/api'
import type { MobileActivity, SavedRecord } from '../lib/api'
import MobileActivitySummary from '../components/MobileActivitySummary'

interface DashboardData {
  month: string; timezone: string; start: string; end: string
  counts: { policies: number; materials: number; schedules: number; drafts: number; announcements: number }
  mobile_activity: MobileActivity
  unknown_publication_dates: number
  drafts: SavedRecord[]; schedules: SavedRecord[]; policies: SavedRecord[]; materials: SavedRecord[]
}
const statistics = [
  { key: 'policies', label: 'Policies Published', icon: FileText, tone: 'blue' },
  { key: 'materials', label: 'Materials Published', icon: BookOpen, tone: 'amber' },
  { key: 'schedules', label: 'Collection Schedules', icon: CalendarDays, tone: 'green' },
  { key: 'drafts', label: 'Saved Drafts', icon: FileText, tone: 'purple' },
] as const

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('month') || ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(selected) && selected >= '0001-01' && selected <= '9999-11' ? selected : localDate().slice(0, 7)
  const [result, setResult] = useState<{ month: string; data?: DashboardData; error?: string } | null>(null)
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(true)
  useEffect(() => {
    let active = true
    api<DashboardData>(`dashboard/?month=${month}`)
      .then((data) => { if (active) { setResult({ month, data }); setPending(false) } })
      .catch((error) => { if (active) { setResult({ month, error: message(error) }); setPending(false) } })
    return () => { active = false }
  }, [month, revision])
  const loading = pending || result?.month !== month
  const data = !loading ? result?.data : undefined
  const error = !loading ? result?.error : undefined
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
  const empty = (label: string) => <EmptyState loading={loading} label={error ? 'Data could not be loaded.' : label} />
  function recent(kind: 'policies' | 'materials') {
    return data?.[kind].length ? <ul className="update-list">{data[kind].map((row) => <li className="update-row" key={row.id}>
      <span className="update-dot" aria-hidden="true" /><span className="update-title">{row.title}{kind === 'materials' && <span> ({row.material_type})</span>}</span>
      <time dateTime={row.updated_at}>{prettyDate(row.updated_at)}</time><Badge status={row.status} />
    </li>)}</ul> : empty(`No ${kind === 'policies' ? 'policies' : 'educational materials'} updated in ${monthLabel}.`)
  }
  return <div className="dashboard" aria-busy={loading}>
    <PageHeading title="Dashboard" description="Overview of content and collection activity for the selected month.">
      <div className="dashboard-period"><label className="date-range"><CalendarDays size={16} aria-hidden="true" /><input aria-label="Dashboard month" type="month" min="0001-01" max="9999-11" value={month} onChange={(event) => { if (event.target.validity.valid && event.target.value) { setPending(true); setParams({ month: event.target.value }) } }} /></label>
        <span className="dashboard-date-range">{data ? `${prettyDate(data.start)} – ${prettyDate(data.end)}` : loading ? 'Loading date range…' : 'Date range unavailable'}</span>
      </div>
    </PageHeading>
    {error && <p className="notice notice--error" role="alert">Dashboard could not be loaded. {error}<button className="text-link" onClick={() => { setPending(true); setRevision((v) => v + 1) }}>Retry</button></p>}
    <div className="statistics-grid grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Dashboard statistics">
      {statistics.map(({ key, label, icon, tone }) => <section className="stat-card" key={key} aria-label={label}><IconTile icon={icon} tone={tone} /><div><strong>{data ? data.counts[key].toLocaleString('en-US') : loading ? '…' : '—'}</strong><span>{label}</span><small>{key === 'drafts' ? 'Drafts updated this month' : 'Selected month'}</small></div></section>)}
    </div>
    {data && <MobileActivitySummary data={data.mobile_activity} />}
    {data && data.unknown_publication_dates > 0 && <p className="notice publication-note" role="note">{data.unknown_publication_dates} published record{data.unknown_publication_dates === 1 ? ' has' : 's have'} no historical publication date and {data.unknown_publication_dates === 1 ? 'is' : 'are'} excluded from publication totals. Future publications record this date automatically.</p>}
    <div className="dashboard-primary">
      <section className="panel drafts-panel" aria-label="Drafts & Pending Work">
        <div className="panel-heading"><h2>Drafts &amp; Pending Work</h2><details className="draft-destinations"><summary className="text-link">View All</summary><div><Link to="/policies?status=Draft">Policy drafts</Link><Link to="/materials?status=Draft">Educational material drafts</Link><Link to="/announcements?status=Draft">Announcement drafts</Link></div></details></div>
        {data?.drafts.length ? <div className="table-scroll"><table className="management-table dashboard-drafts"><thead><tr><th>Content Title</th><th>Type</th><th>Status</th><th>Last Updated</th><th>Updated By</th><th>Action</th></tr></thead><tbody>{data.drafts.map((row) => <tr key={`${row.type}-${row.id}`}>
          <td>{row.title}</td><td>{row.type === 'policies' ? 'Policy' : row.type === 'announcements' ? 'Announcement' : 'Educational Material'}</td><td><Badge status={row.status} /></td><td><time dateTime={row.updated_at}>{prettyDate(row.updated_at)}</time></td><td>{row.updated_by}</td><td><Link className="continue-editing" aria-label={`Continue Editing ${row.title}`} to={`/${row.type}?edit=${row.id}`}>Continue Editing</Link></td>
        </tr>)}</tbody></table></div> : empty(`No saved drafts updated in ${monthLabel}.`)}
      </section>
      <Panel title="Collection Schedules" action={{ label: 'View All', to: `/schedules?month=${month}` }} className="schedules-panel">
        <p className="dashboard-section-period">{monthLabel}</p>
        {data?.schedules.length ? <div className="schedule-list">{data.schedules.map((row) => <div className="schedule-row" key={row.id}>
          <IconTile icon={row.waste_type === 'Recyclable' ? Recycle : row.waste_type === 'Biodegradable' ? Leaf : Trash2} tone={row.waste_type === 'Recyclable' ? 'green' : row.waste_type === 'Biodegradable' ? 'lime' : 'red'} />
          <div className="schedule-details"><h3>{row.waste_type} Waste</h3><p><time dateTime={row.collection_date}>{prettyDate(row.collection_date, true)}</time><span className="schedule-separator">|</span>{row.barangay}<span className="schedule-separator">|</span>{timeLabel(row.start_time)} – {timeLabel(row.end_time)}</p></div><Badge status={row.status} />
        </div>)}</div> : empty(`No collection schedules in ${monthLabel}.`)}
      </Panel>
    </div>
    <div className="dashboard-secondary">
      <Panel title="Recent Policies & Guidelines" action={{ label: 'View All', to: '/policies' }}>{recent('policies')}</Panel>
      <Panel title="Latest Educational Materials" action={{ label: 'View All', to: '/materials' }}>{recent('materials')}</Panel>
    </div>
  </div>
}
