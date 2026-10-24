import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export function Badge({ status }: { status: string }) {
  return <span className={`status-badge ${['Draft', 'Completed'].includes(status) ? 'status-badge--amber' : ['Deactivated', 'Cancelled'].includes(status) ? 'status-badge--red' : 'status-badge--green'}`}>{status}</span>
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [])
  return <dialog ref={dialog} className="record-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); onClose() }}><div className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</dialog>
}
export function Pagination({ page, pages, count, onPage }: { page: number; pages: number; count: number; onPage: (page: number) => void }) {
  return <div className="pagination"><span>{count} record{count !== 1 ? 's' : ''} · Page {page} of {pages}</span><div><button className="secondary-button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /></button><button className="secondary-button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={15} /></button></div></div>
}
export function EmptyState({ loading, label = 'No records found. Adjust your filters or add a record.' }: { loading: boolean; label?: string }) {
  return <div className="empty-state" role="status">{loading ? 'Loading saved records…' : label}</div>
}
