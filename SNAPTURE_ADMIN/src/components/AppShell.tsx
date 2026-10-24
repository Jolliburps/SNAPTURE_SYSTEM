import { useEffect, useState } from 'react'
import { Bell, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { navigation } from '../config/navigation'
import { useAuth } from '../auth/AuthContext'
import { message } from '../lib/api'

export default function AppShell() {
  const { user, signOut } = useAuth()
  const [error, setError] = useState('')
  async function handleSignOut() { try { await signOut() } catch (error) { setError(message(error)) } }
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-nav-open' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar" id="primary-sidebar" aria-label="Administration sidebar">
      <Link className="brand" to="/dashboard" aria-label="SNAPTURE Admin Panel home" onClick={() => setMobileOpen(false)}>
        <img src="/snapture.svg" width="40" height="40" alt="" />
        <span className="brand-copy"><strong>SNAPTURE</strong><span>Admin Panel</span></span>
      </Link>
      <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={label} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
          <Icon size={19} strokeWidth={2.1} aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-session">
        <button className="nav-item logout-button" onClick={handleSignOut} title="Sign out" aria-label="Sign out"><LogOut size={19} aria-hidden="true" /><span>Sign out</span></button>
        <div className="sidebar-footer"><span className="preview-dot" /><span>CESD personnel</span></div>
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <button className="icon-button desktop-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="primary-sidebar">
          {collapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
        </button>
        <button className="icon-button mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="primary-sidebar"><PanelLeftOpen size={21} /></button>
        <div className="topbar-actions">
          <button className="icon-button notification-button" disabled aria-label="Notifications — coming in a future stage" title="Notifications — coming in a future stage"><Bell size={20} /></button>
          <span className="header-divider" />
          <Link className="admin-profile" to="/settings" aria-label="Open administrator settings">
            <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span><span className="admin-copy"><strong>{user?.name}</strong><span>{user?.department}</span></span><ChevronDown size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main id="main-content" className="page-content" tabIndex={-1}>{error && <p className="notice notice--error" role="alert">{error}</p>}<Outlet /></main>
      <footer className="page-footer"><span>SNAPTURE Admin Panel</span><span>CESD Bacoor</span></footer>
    </div>
  </div>
}
