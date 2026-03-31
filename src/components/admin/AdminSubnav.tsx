import { Link, useLocation } from 'react-router-dom'

export function AdminSubnav() {
  const { pathname } = useLocation()
  const onOverview = pathname === '/admin' || pathname === '/admin/'
  const onDesign = pathname.includes('/admin/design-system')

  return (
    <nav className="admin-subnav" aria-label="Admin sections">
      <Link to="/admin" className={`admin-subnav-link${onOverview ? ' admin-subnav-link--active' : ''}`}>
        Overview
      </Link>
      <Link
        to="/admin/design-system"
        className={`admin-subnav-link${onDesign ? ' admin-subnav-link--active' : ''}`}
      >
        Design system
      </Link>
    </nav>
  )
}
