import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firestore } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

type UserRow = {
  uid: string
  email: string | null
  displayName: string | null
  propertyCount: number
  visits: number | null
  aiGenerations: number | null
  isAdmin: boolean
  lastVisit: Date | null
}

function adminEmailSet() {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...fromEnv, 'cheng.cesar@gmail.com'])
}

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type SortKey = 'email' | 'uid' | 'isAdmin' | 'propertyCount' | 'visits' | 'aiGenerations' | 'lastVisit'
type SortDir = 'asc' | 'desc'
type AdminFilter = 'all' | 'admin' | 'non-admin'

const ALL_COLS = ['email', 'uid', 'isAdmin', 'propertyCount', 'visits', 'aiGenerations', 'lastVisit'] as const
type ColKey = typeof ALL_COLS[number]
const COL_LABELS: Record<ColKey, string> = {
  email: 'Email',
  uid: 'User ID',
  isAdmin: 'Admin',
  propertyCount: 'Properties',
  visits: 'Visits',
  aiGenerations: 'AI Gen',
  lastVisit: 'Last Visit',
}
const COL_ALIGN: Record<ColKey, 'left' | 'right' | 'center'> = {
  email: 'left', uid: 'left', isAdmin: 'center', propertyCount: 'right',
  visits: 'right', aiGenerations: 'right', lastVisit: 'right',
}

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
  </svg>
)
const IconFilter = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.666 5.083h10.667"/><path d="M4.666 8h6.667"/><path d="M6.666 10.917h2.667"/>
  </svg>
)
const IconColumns = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M.52 0A.525.525 0 000 .525v13.347c0 .29.235.525.52.525h14.96a.525.525 0 00.52-.525V.525A.525.525 0 0015.48 0H.52zm.53 1.05h4.55v2.287H1.05V1.05zm5.6 0h8.3v2.287h-8.3V1.05zM1.05 4.387h4.55V6.675H1.05V4.387zm5.6 0h8.3V6.675h-8.3V4.387zM1.05 7.724h4.55v2.286H1.05V7.724zm5.6 0h8.3v2.286h-8.3V7.724zM1.05 11.062h4.55v2.286H1.05v-2.286zm5.6 0h8.3v2.286h-8.3v-2.286z" fill="#4B5563"/></svg>
)
const IconEye = ({ visible }: { visible: boolean }) => visible ? (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><ellipse cx="9" cy="9" rx="7.5" ry="5.25" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2.25" stroke="#3b82f6" strokeWidth="1.5"/></svg>
) : (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7.58 7.58a2.003 2.003 0 002.84 2.84M13.36 13.36C12.12 14.27 10.62 14.78 9 14.75c-5.25 0-7.5-5.25-7.5-5.25a13.16 13.16 0 013.64-4.11m2.91-1.16A5.7 5.7 0 019 4c5.25 0 7.5 5.25 7.5 5.25a13.24 13.24 0 01-1.47 2.15M1.5 1.5l15 15" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export default function AdminPage() {
  const auth = useAuth() as unknown as { user: any; isAdmin: boolean } | null
  const { user, isAdmin } = auth ?? { user: null, isAdmin: false }
  const [users, setUsers] = useState<UserRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('propertyCount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [adminFilter, setAdminFilter] = useState<AdminFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colVis, setColVis] = useState<Record<ColKey, boolean>>({
    email: true, uid: true, isAdmin: true, propertyCount: true,
    visits: true, aiGenerations: true, lastVisit: true,
  })
  const filterRef = useRef<HTMLDivElement>(null)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
            const email = (data.email ?? '').toLowerCase()
            return {
              uid: userDoc.id,
              email: data.email ?? null,
              displayName: data.displayName ?? null,
              propertyCount: propsSnap.size,
              visits: data.usage?.visits ?? null,
              aiGenerations: data.usage?.aiGenerations ?? null,
              isAdmin: data.role?.toLowerCase() === 'admin' || adminEmailSet().has(email),
              lastVisit: data.lastLoginAt?.toDate?.() ?? null,
            }
          })
        )
        setUsers(rows)
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [user, isAdmin])

  const sortedUsers = useMemo(() => {
    const mul = sortDir === 'asc' ? 1 : -1
    return [...users].sort((a, b) => {
      switch (sortKey) {
        case 'email': return mul * (a.email ?? '').localeCompare(b.email ?? '')
        case 'uid': return mul * a.uid.localeCompare(b.uid)
        case 'isAdmin': return mul * (Number(a.isAdmin) - Number(b.isAdmin))
        case 'propertyCount': return mul * (a.propertyCount - b.propertyCount)
        case 'visits': return mul * ((a.visits ?? -1) - (b.visits ?? -1))
        case 'aiGenerations': return mul * ((a.aiGenerations ?? -1) - (b.aiGenerations ?? -1))
        case 'lastVisit': return mul * ((a.lastVisit?.getTime() ?? 0) - (b.lastVisit?.getTime() ?? 0))
        default: return 0
      }
    })
  }, [users, sortKey, sortDir])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sortedUsers.filter(u => {
      if (adminFilter === 'admin' && !u.isAdmin) return false
      if (adminFilter === 'non-admin' && u.isAdmin) return false
      if (q) {
        const inEmail = (u.email ?? '').toLowerCase().includes(q)
        const inName = (u.displayName ?? '').toLowerCase().includes(q)
        if (!inEmail && !inName) return false
      }
      return true
    })
  }, [sortedUsers, searchQuery, adminFilter])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleCol(key: ColKey) {
    if (key === 'email') return // always visible
    setColVis(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 10 }}>↕</span>
    return <span style={{ marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const visibleCols = ALL_COLS.filter(k => colVis[k])
  const totalProperties = users.reduce((sum, u) => sum + u.propertyCount, 0)
  const filterActive = adminFilter !== 'all'

  return (
    <div className="admin-page-inner">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>Admin overview</h1>
        <p style={{ fontSize: 14, color: 'var(--text3)', margin: '6px 0 0' }}>User activity across Firestore</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
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

      {/* Filter bar */}
      <div className="filter-bar mb24">
        <div className="filter-bar-top">
          {/* Filter button */}
          <div ref={filterRef} style={{ position: 'relative' }}>
            <button
              className={`filter-bar-icon-btn filter-bar-filter-btn${filterActive ? ' active' : ''}`}
              title="Filter"
              onClick={() => setFilterOpen(v => !v)}
            >
              <IconFilter />
            </button>
            {filterOpen && (
              <div style={{
                position: 'absolute', left: 0, top: '100%', marginTop: 6,
                background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 180,
                animation: 'selectSlideIn 0.15s ease-out',
              }}>
                <div style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Role
                </div>
                {(['all', 'admin', 'non-admin'] as AdminFilter[]).map(opt => (
                  <button
                    key={opt}
                    className="ghost"
                    onClick={() => { setAdminFilter(opt); setFilterOpen(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 13, borderRadius: 0,
                      color: adminFilter === opt ? 'var(--accent-bg)' : 'var(--text)',
                      fontWeight: adminFilter === opt ? 600 : 400,
                    }}
                  >
                    {{ all: 'All users', admin: 'Admins only', 'non-admin': 'Non-admins' }[opt]}
                    {adminFilter === opt && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7l3 3 6-6"/></svg>
                    )}
                  </button>
                ))}
                <div style={{ height: 6 }} />
              </div>
            )}
          </div>

          {/* Search */}
          <div className="filter-bar-search">
            <IconSearch />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Column visibility */}
          <div className="filter-bar-actions">
            <div ref={colMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`filter-bar-icon-btn${colMenuOpen ? ' active' : ''}`}
                title="Column visibility"
                onClick={() => setColMenuOpen(v => !v)}
              >
                <IconColumns />
              </button>
              {colMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6,
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 200,
                  animation: 'selectSlideIn 0.15s ease-out',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Column visibility
                  </div>
                  {ALL_COLS.map(key => {
                    const on = colVis[key]
                    const locked = key === 'email'
                    return (
                      <div
                        key={key}
                        style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', gap: 10 }}
                      >
                        <span style={{ flex: 1, fontSize: 13, color: locked ? 'var(--text3)' : 'var(--text)', fontWeight: locked ? 400 : 500 }}>
                          {COL_LABELS[key]}
                        </span>
                        {locked ? (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Always on</span>
                        ) : (
                          <button
                            type="button"
                            className="ghost"
                            style={{ padding: 4, lineHeight: 0 }}
                            title={on ? 'Hide column' : 'Show column'}
                            onClick={() => toggleCol(key)}
                          >
                            <IconEye visible={on} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <div style={{ height: 6 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User table */}
      <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {visibleCols.map(key => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as SortKey)}
                    style={{ padding: '12px 20px', textAlign: COL_ALIGN[key], fontSize: 11, fontWeight: 600, color: sortKey === key ? 'var(--text2)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    {COL_LABELS[key]}<SortArrow col={key as SortKey} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={visibleCols.length} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)' }}>Loading…</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)' }}>No users match your filters.</td>
                </tr>
              ) : filteredUsers.map((u, i) => (
                <tr
                  key={u.uid}
                  style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {visibleCols.includes('email') && (
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{u.email ?? '—'}</div>
                      {u.displayName && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{u.displayName}</div>}
                    </td>
                  )}
                  {visibleCols.includes('uid') && (
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.uid}
                    </td>
                  )}
                  {visibleCols.includes('isAdmin') && (
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      {u.isAdmin ? (
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: 'var(--accent-hover, #2563eb)', background: 'var(--accent-subtle-bg, rgba(59,130,246,0.1))', borderRadius: 6, padding: '2px 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                          Admin
                        </span>
                      ) : '—'}
                    </td>
                  )}
                  {visibleCols.includes('propertyCount') && (
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                      {u.propertyCount}
                    </td>
                  )}
                  {visibleCols.includes('visits') && (
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text2)' }}>
                      {u.visits ?? '—'}
                    </td>
                  )}
                  {visibleCols.includes('aiGenerations') && (
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text2)' }}>
                      {u.aiGenerations ?? '—'}
                    </td>
                  )}
                  {visibleCols.includes('lastVisit') && (
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {fmtDate(u.lastVisit)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
