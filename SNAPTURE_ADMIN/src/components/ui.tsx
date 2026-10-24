import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { PublicationStatus } from '../types'

export function IconTile({ icon: Icon, tone = 'green' }: { icon: LucideIcon; tone?: 'green' | 'blue' | 'amber' | 'lime' | 'red' | 'purple' }) {
  return <span className={`icon-tile icon-tile--${tone}`}><Icon aria-hidden="true" size={26} strokeWidth={2.2} /></span>
}

export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{children}</div>
}

export function Panel({ title, action, children, className = '' }: { title: string; action?: { label: string; to: string }; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`} aria-label={title}>
    <div className="panel-heading"><h2>{title}</h2>{action && <Link className="text-link" to={action.to}>{action.label}</Link>}</div>
    {children}
  </section>
}

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={`status-badge ${status === 'Published' ? 'status-badge--green' : 'status-badge--amber'}`}>{status}</span>
}
