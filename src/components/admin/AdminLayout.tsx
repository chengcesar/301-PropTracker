import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthHeader from '../AuthHeader'
import { AdminSubnav } from './AdminSubnav'

export default function AdminLayout() {
  const auth = useAuth() as unknown as { user: unknown; loading: boolean; isAdmin: boolean } | null
  const { user, loading, isAdmin } = auth ?? { user: null, loading: true, isAdmin: false }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <AuthHeader />
      <div className="app-body">
        <div className="admin-layout">
          <div className="admin-layout-top">
            <AdminSubnav />
          </div>
          <div className="admin-layout-outlet">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  )
}
