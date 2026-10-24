import type { MobileActivity } from '../lib/api'

export default function MobileActivitySummary({ data }: { data: MobileActivity }) {
  return <section className="panel mobile-activity" aria-label="Mobile activity"><div className="panel-heading"><h2>Mobile activity</h2></div>
    <div className="report-summary">{([
      ['scans', 'Saved scans'], ['items', 'Saved items'], ['projects_started', 'Projects started'],
      ['projects_active', 'Active projects'], ['projects_completed', 'Completed projects'],
    ] as const).map(([key, label]) => <div className="stat-card" key={key}><div><strong>{data[key].toLocaleString()}</strong><span>{label}</span></div></div>)}</div>
    <p className="report-note">Scans and projects created in the selected date range. Project counts show their current progress, including later updates. A scan can contain multiple items. Deleted records are excluded.</p>
  </section>
}
