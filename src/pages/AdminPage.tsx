import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firestore } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

type UserRow = {
  uid: string
  email: string | null
  displayName: string | null
  propertyCount: number
  visits: number | null
}

export default function AdminPage() {
  const auth = useAuth() as unknown as { user: any; isAdmin: boolean } | null
  const { user, isAdmin } = auth ?? { user: null, isAdmin: false }
  const [users, setUsers] = useState<UserRow[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user || !isAdmin || !firestore) return

    async function fetchData() {
      setFetching(true)
      try {
        const usersSnap = await getDocs(collection(firestore!, 'users'))
        const rows: UserRow[] = await Promise.all(
          usersSnap.docs.map(async (userDoc) => {
            const data = userDoc.data()
            const propsSnap = await getDocs(collection(firestore!, 'users', userDoc.id, 'properties'))
            return {
              uid: userDoc.id,
              email: data.email ?? null,
              displayName: data.displayName ?? null,
              propertyCount: propsSnap.size,
              visits: data.usage?.visits ?? null,
            }
          })
        )
        // Sort by property count desc
        rows.sort((a, b) => b.propertyCount - a.propertyCount)
        setUsers(rows)
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [user, isAdmin])

  const totalProperties = users.reduce((sum, u) => sum + u.propertyCount, 0)

  return (
    <div className="admin-page-inner">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>Admin overview</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: '6px 0 0' }}>User activity across Firestore</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div className="chart-card" style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              Total users
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {fetching ? '—' : users.length}
            </div>
          </div>
          <div className="chart-card" style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              Total properties
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {fetching ? '—' : totalProperties}
            </div>
          </div>
        </div>

        {/* User table */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Email</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>User ID</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Properties</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Visits</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)' }}>Loading…</td>
                </tr>
              ) : users.map((u, i) => (
                <tr
                  key={u.uid}
                  style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{u.email ?? '—'}</div>
                    {u.displayName && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{u.displayName}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.uid}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                    {u.propertyCount}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text2)' }}>
                    {u.visits ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

    </div>
  )
}
