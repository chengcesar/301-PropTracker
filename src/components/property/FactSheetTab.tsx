import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FactSheet, Property, PropertyContact, OwnershipEntry, MortgageInfo } from '../../lib/types'
import { fmt } from '../../lib/format'
import type { CurrencyCode } from '../../lib/currency'
import { COUNTRIES } from '../../lib/countries'
import { uploadPropertyPhoto, deletePropertyPhoto, uploadPropertyDocument, deletePropertyDocument } from '../../lib/photoStorage'
import { PROPERTY_TYPES, getSpatialFields } from '../../lib/constants'

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
)
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
)
const CONTACT_ROLES = ['Owner', 'Property Manager', 'Building Manager', 'Broker', 'Insurance', 'Lawyer', 'Accountant', 'Other'] as const

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

const EMPTY_MORTGAGE: MortgageInfo = {
  hasMortgage: false,
  lender: '',
  loanNumber: '',
  originalAmount: null,
  outstandingBalance: null,
  monthlyPayment: null,
  interestRate: null,
  rateType: '',
  termMonths: null,
  startDate: '',
  endDate: '',
}

const EMPTY: FactSheet = {
  propertyType: '',
  estrato: null,
  yearBuilt: null,
  lastRenovation: null,
  floor: null,
  matriculaInmobiliaria: '',
  cedulaCatastral: '',
  chip: '',
  customId: '',
  purchasePrice: null,
  purchaseDate: '',
  currentValue: null,
  valuationDate: '',
  photos: [],
  owners: [],
  mortgage: { ...EMPTY_MORTGAGE },
  contacts: [],
  notes: '',
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div>
      <div className="ct-field-label">{label}</div>
      <div className="ct-field-val">{display}</div>
    </div>
  )
}

export function FactSheetTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
  const fs = prop.factSheet ?? EMPTY
  const [editingChars, setEditingChars] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [repositionPin, setRepositionPin] = useState(false)
  const [mapLocked, setMapLocked] = useState(true)
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const geoTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const geoBoxRef = useRef<HTMLDivElement>(null)

  // Debounced Nominatim search
  useEffect(() => {
    if (geoQuery.trim().length < 3) { setGeoResults([]); return }
    if (geoTimerRef.current) clearTimeout(geoTimerRef.current)
    geoTimerRef.current = setTimeout(async () => {
      setGeoLoading(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(geoQuery)}`)
        const data = await res.json()
        setGeoResults(data)
      } catch { setGeoResults([]) }
      finally { setGeoLoading(false) }
    }, 400)
    return () => { if (geoTimerRef.current) clearTimeout(geoTimerRef.current) }
  }, [geoQuery])

  // Click outside to close results
  useEffect(() => {
    if (geoResults.length === 0) return
    const handler = (e: MouseEvent) => {
      if (geoBoxRef.current && !geoBoxRef.current.contains(e.target as Node)) setGeoResults([])
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [geoResults.length])

  const selectGeoResult = (r: { lat: string; lon: string }) => {
    const lat = Math.round(parseFloat(r.lat) * 1e6) / 1e6
    const lng = Math.round(parseFloat(r.lon) * 1e6) / 1e6
    setProp('latitude', lat)
    setProp('longitude', lng)
    setGeoQuery('')
    setGeoResults([])
  }

  const [editingLegal, setEditingLegal] = useState(false)
  const [editingOwnership, setEditingOwnership] = useState(false)
  const [editingMortgage, setEditingMortgage] = useState(false)

  const set = <K extends keyof FactSheet>(k: K, v: FactSheet[K]) => {
    onUpdateProp((p) => ({ ...p, factSheet: { ...(p.factSheet ?? EMPTY), [k]: v } }))
  }

  const setNum = (k: keyof FactSheet, raw: string) => {
    const n = parseFloat(raw.replace(/[^\d]/g, '')) || null
    set(k, n as FactSheet[keyof FactSheet])
  }

  const setProp = <K extends keyof Property>(k: K, v: Property[K]) => {
    onUpdateProp((p) => ({ ...p, [k]: v }))
  }

  const setPropNum = (k: keyof Property, raw: string) => {
    setProp(k, (parseFloat(raw.replace(/[^\d.]/g, '')) || 0) as Property[keyof Property])
  }

  /* ── Ownership ── */
  const owners: OwnershipEntry[] = fs.owners?.length
    ? fs.owners
    : prop.owner
      ? [{ id: 0, name: prop.owner, idNumber: '', equityPct: 100, notes: '' }]
      : []
  const ownersTotalPct = owners.reduce((s, o) => s + o.equityPct, 0)

  const addOwner = () => {
    const entry: OwnershipEntry = { id: Date.now(), name: '', idNumber: '', equityPct: 0, notes: '' }
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      const current = f.owners?.length ? f.owners : p.owner ? [{ id: 0, name: p.owner, idNumber: '', equityPct: 100, notes: '' }] : []
      return { ...p, factSheet: { ...f, owners: [...current, entry] } }
    })
  }

  const updateOwner = (id: number, patch: Partial<OwnershipEntry>) => {
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      const current = f.owners?.length ? f.owners : p.owner ? [{ id: 0, name: p.owner, idNumber: '', equityPct: 100, notes: '' }] : []
      const updated = current.map((o) => (o.id === id ? { ...o, ...patch } : o))
      const primaryOwner = updated[0]?.name || ''
      const ownerDisplay = updated.length <= 2 ? updated.map((o) => o.name).filter(Boolean).join(', ') : `${primaryOwner} +${updated.length - 1}`
      return { ...p, owner: ownerDisplay, factSheet: { ...f, owners: updated } }
    })
  }

  const removeOwner = (id: number) => {
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      const current = (f.owners ?? []).filter((o) => o.id !== id)
      const ownerDisplay = current.length <= 2 ? current.map((o) => o.name).filter(Boolean).join(', ') : `${current[0]?.name || ''} +${current.length - 1}`
      return { ...p, owner: ownerDisplay, factSheet: { ...f, owners: current } }
    })
  }

  /* ── Mortgage ── */
  const mortgage = fs.mortgage ?? EMPTY_MORTGAGE

  const setMortgage = <K extends keyof MortgageInfo>(k: K, v: MortgageInfo[K]) => {
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      return { ...p, factSheet: { ...f, mortgage: { ...(f.mortgage ?? EMPTY_MORTGAGE), [k]: v } } }
    })
  }

  const setMortgageNum = (k: keyof MortgageInfo, raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.]/g, '')) || null
    setMortgage(k, n as MortgageInfo[keyof MortgageInfo])
  }

  const contacts = fs.contacts ?? []

  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', role: 'Property Manager' as string, phone: '', email: '' })
  const setContactField = <K extends keyof typeof contactForm>(k: K, v: (typeof contactForm)[K]) => {
    setContactForm((p) => ({ ...p, [k]: v }))
  }

  const resetContactForm = () => {
    setContactForm({ name: '', role: 'Property Manager', phone: '', email: '' })
    setShowContactForm(false)
    setEditingContactId(null)
  }

  const addContact = () => {
    if (!contactForm.name.trim()) return
    const entry: PropertyContact = {
      id: Date.now(),
      name: contactForm.name.trim(),
      role: contactForm.role,
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim(),
    }
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      return { ...p, factSheet: { ...f, contacts: [...(f.contacts ?? []), entry] } }
    })
    resetContactForm()
  }

  const startEditContact = (c: PropertyContact) => {
    setEditingContactId(c.id)
    setContactForm({ name: c.name, role: c.role, phone: c.phone, email: c.email })
    setShowContactForm(true)
  }

  const saveEditContact = () => {
    if (!contactForm.name.trim() || editingContactId === null) return
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      return {
        ...p,
        factSheet: {
          ...f,
          contacts: (f.contacts ?? []).map((c) =>
            c.id === editingContactId
              ? { ...c, name: contactForm.name.trim(), role: contactForm.role, phone: contactForm.phone.trim(), email: contactForm.email.trim() }
              : c
          ),
        },
      }
    })
    resetContactForm()
  }

  const removeContact = (id: number) => {
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      return { ...p, factSheet: { ...f, contacts: (f.contacts ?? []).filter((c) => c.id !== id) } }
    })
  }

  /* ── Photos ── */
  const photos = fs.photos ?? []
  const [activePhoto, setActivePhoto] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const url = await uploadPropertyPhoto(prop.id, file)
        onUpdateProp((p) => {
          const f = p.factSheet ?? EMPTY
          return { ...p, factSheet: { ...f, photos: [...(f.photos ?? []), url] } }
        })
      }
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async (idx: number) => {
    const url = photos[idx]
    if (!url) return
    try { await deletePropertyPhoto(url) } catch { /* already deleted or local */ }
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      const next = (f.photos ?? []).filter((_, i) => i !== idx)
      return { ...p, factSheet: { ...f, photos: next } }
    })
    setActivePhoto((prev) => Math.min(prev, Math.max(0, photos.length - 2)))
  }

  /* ── Documents (maps, floor plans, etc.) ── */
  const documents = fs.documents ?? []
  const [activeDoc, setActiveDoc] = useState(0)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const docFileRef = useRef<HTMLInputElement>(null)

  const isPdf = (url: string) => /\.pdf/i.test(url)

  /* ── Document viewer zoom & pan ── */
  const [docZoom, setDocZoom] = useState(1)
  const [docPan, setDocPan] = useState({ x: 0, y: 0 })
  const docDragRef = useRef<{ dragging: boolean; startX: number; startY: number; panX: number; panY: number }>({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 })
  const docViewerRef = useRef<HTMLDivElement>(null)

  const resetDocView = useCallback(() => { setDocZoom(1); setDocPan({ x: 0, y: 0 }) }, [])

  // Reset view when switching documents
  useEffect(() => { resetDocView() }, [activeDoc, resetDocView])

  // Native wheel listener with { passive: false } so preventDefault() works
  useEffect(() => {
    const el = docViewerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setDocZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const handleDocPointerDown = useCallback((e: React.PointerEvent) => {
    docDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: docPan.x, panY: docPan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [docPan])

  const handleDocPointerMove = useCallback((e: React.PointerEvent) => {
    const d = docDragRef.current
    if (!d.dragging) return
    setDocPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) })
  }, [])

  const handleDocPointerUp = useCallback(() => {
    docDragRef.current.dragging = false
  }, [])

  const addDocuments = async (files: FileList | null) => {
    if (!files) return
    setUploadingDoc(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') continue
        const url = await uploadPropertyDocument(prop.id, file)
        onUpdateProp((p) => {
          const f = p.factSheet ?? EMPTY
          return { ...p, factSheet: { ...f, documents: [...(f.documents ?? []), url] } }
        })
      }
    } finally {
      setUploadingDoc(false)
    }
  }

  const removeDocument = async (idx: number) => {
    const url = documents[idx]
    if (!url) return
    try { await deletePropertyDocument(url) } catch { /* already deleted */ }
    onUpdateProp((p) => {
      const f = p.factSheet ?? EMPTY
      const next = (f.documents ?? []).filter((_, i) => i !== idx)
      return { ...p, factSheet: { ...f, documents: next } }
    })
    setActiveDoc((prev) => Math.min(prev, Math.max(0, documents.length - 2)))
  }

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    const headers = ['Name', 'Role', 'Phone', 'Email']
    const rows = contacts.map((c) =>
      [c.name, c.role, c.phone || '—', c.email || '—'].join('\t')
    )
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [contacts])


  return (
    <div>
      {/* Photos + Property characteristics */}
      <div className="fs-duo">
      {/* Photos */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-inner" style={{ padding: 0 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            hidden
            onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }}
          />
          {uploading && photos.length === 0 ? (
            <div className="fs-photo-skeleton">
              <svg className="fs-photo-spinner" width="30" height="30" viewBox="0 0 90 90" fill="none">
                <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#0539FF"/>
                <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#0539FF"/>
                <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#0539FF"/>
                <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#0539FF"/>
              </svg>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>Loading…</div>
            </div>
          ) : photos.length > 0 ? (
            <>
              <div className="fs-photo-hero">
                {uploading && (
                  <div className="fs-photo-uploading-overlay">
                    <svg className="fs-photo-spinner" width="28" height="28" viewBox="0 0 90 90" fill="none">
                      <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#fff"/>
                      <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#fff"/>
                      <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#fff"/>
                      <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#fff"/>
                    </svg>
                    <div style={{ fontSize: 13, color: '#fff', marginTop: 8 }}>Loading…</div>
                  </div>
                )}
                <img src={photos[activePhoto] ?? photos[0]} alt="Property" />
                <span className="fs-photo-count">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
                <a className="fs-photo-dl" href={photos[activePhoto] ?? photos[0]} download={`photo-${activePhoto + 1}.jpg`} title="Download photo">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
                <button type="button" className="fs-photo-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploading…' : '+ Add photo'}
                </button>
              </div>
              <div className="fs-photo-strip">
                {photos.map((src, i) => (
                  <div key={i} className={`fs-thumb${i === activePhoto ? ' active' : ''}`}>
                    <img src={src} alt="" onClick={() => setActivePhoto(i)} />
                    <button type="button" className="fs-thumb-del" onClick={() => removePhoto(i)}>×</button>
                  </div>
                ))}
                {uploading && (
                  <div className="fs-thumb fs-thumb-skeleton">
                    <div className="fs-thumb-shimmer" />
                  </div>
                )}
                <button type="button" className="fs-thumb-add" onClick={() => fileRef.current?.click()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
            </>
          ) : (
            <div className="fs-photo-empty" onClick={() => !uploading && fileRef.current?.click()}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c4c9d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>Upload main photo</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>JPEG or PNG</div>
            </div>
          )}
        </div>
      </div>

      {/* Property characteristics */}
      <div className="card">
        <div className="card-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sec-title" style={{ margin: 0 }}>Property characteristics</span>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 14px', border: '1px solid var(--accent-bg)', color: 'var(--accent-bg)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setEditingChars(!editingChars)}
            >
              {editingChars ? 'Done' : 'Edit'}
            </button>
          </div>
          {/* ── Properties ── */}
          <div className="ct-field-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Properties</div>
          {editingChars ? (
            <div className="contract-grid" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Property type</label>
                <select value={fs.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                  <option value="">Select...</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Year built</label>
                <input type="text" placeholder="2015" value={fs.yearBuilt ?? ''} onChange={(e) => setNum('yearBuilt', e.target.value)} />
              </div>
              <div className="field">
                <label>Last renovation</label>
                <input type="text" placeholder="2022" value={fs.lastRenovation ?? ''} onChange={(e) => setNum('lastRenovation', e.target.value)} />
              </div>
              <div className="field">
                <label>Floor</label>
                <input type="text" placeholder="5" value={fs.floor ?? ''} onChange={(e) => setNum('floor', e.target.value)} />
              </div>
              <div className="field">
                <label>Concierge</label>
                <select value={prop.concierge ? 'yes' : 'no'} onChange={(e) => setProp('concierge', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="ct-fields" style={{ marginBottom: 20 }}>
              <ReadOnlyField label="Property type" value={fs.propertyType} />
              <ReadOnlyField label="Year built" value={fs.yearBuilt} />
              <ReadOnlyField label="Last renovation" value={fs.lastRenovation} />
              <ReadOnlyField label="Floor" value={fs.floor} />
              <ReadOnlyField label="Concierge" value={prop.concierge ? 'Yes' : 'No'} />
            </div>
          )}

          {/* ── Spatial features ── */}
          <div className="ct-field-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Spatial features</div>
          {editingChars ? (
            <div className="contract-grid">
              {getSpatialFields(fs.propertyType).map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={(prop[f.key as keyof Property] as string | number) || ''} onChange={(e) => setPropNum(f.key as keyof Property, e.target.value)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="ct-fields">
              {getSpatialFields(fs.propertyType).map((f) => {
                const val = prop[f.key as keyof Property]
                return (
                  <ReadOnlyField
                    key={f.key}
                    label={f.suffix ? f.label.replace(` (${f.suffix})`, '') : f.label}
                    value={val ? (f.suffix ? `${val} ${f.suffix}` : val as string | number) : null}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Map + Location info */}
      <div className="fs-duo">
        {/* Map */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-inner" style={{ padding: 0 }}>
            {prop.latitude != null && prop.longitude != null ? (
              <div className="fs-map-wrap">
                <Map
                  initialViewState={{ longitude: prop.longitude, latitude: prop.latitude, zoom: 15 }}
                  mapStyle={CARTO_STYLE}
                  style={{ width: '100%', height: '100%' }}
                  attributionControl={false}
                  scrollZoom={!mapLocked}
                  boxZoom={!mapLocked}
                  dragPan={!mapLocked || repositionPin}
                  dragRotate={!mapLocked}
                  doubleClickZoom={!mapLocked}
                  touchZoomRotate={!mapLocked}
                  cursor={repositionPin ? 'crosshair' : mapLocked ? 'default' : 'grab'}
                  onClick={repositionPin ? (e) => {
                    setProp('latitude', Math.round(e.lngLat.lat * 1e6) / 1e6)
                    setProp('longitude', Math.round(e.lngLat.lng * 1e6) / 1e6)
                  } : undefined}
                >
                  <Marker
                    longitude={prop.longitude}
                    latitude={prop.latitude}
                    anchor="bottom"
                    draggable={repositionPin}
                    onDragEnd={(e) => {
                      setProp('latitude', Math.round(e.lngLat.lat * 1e6) / 1e6)
                      setProp('longitude', Math.round(e.lngLat.lng * 1e6) / 1e6)
                    }}
                  >
                    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" style={{ cursor: repositionPin ? 'grab' : undefined }}>
                      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#3b82f6"/>
                      <circle cx="14" cy="13" r="5" fill="#fff"/>
                    </svg>
                  </Marker>
                </Map>
                {repositionPin && (
                  <div className="fs-map-search" ref={geoBoxRef}>
                    <svg className="fs-map-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input
                      type="text"
                      className="fs-map-search-input"
                      placeholder="Search location…"
                      value={geoQuery}
                      onChange={(e) => setGeoQuery(e.target.value)}
                    />
                    {geoLoading && <span className="fs-map-search-spin" />}
                    {geoResults.length > 0 && (
                      <div className="fs-map-search-results">
                        {geoResults.map((r, i) => (
                          <button key={i} type="button" className="fs-map-search-item" onClick={() => selectGeoResult(r)}>
                            {r.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {repositionPin ? (
                  <div className="fs-map-edit-hint">
                    <span>Drag the pin or click to reposition</span>
                    <button type="button" className="fs-map-done-btn" onClick={() => { setRepositionPin(false); setMapLocked(true) }}>Done</button>
                  </div>
                ) : (
                  <div className="fs-map-btn-group">
                    <button type="button" className="fs-map-edit-btn" onClick={() => setMapLocked(l => !l)} title={mapLocked ? 'Unlock map' : 'Lock map'}>
                      {mapLocked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/>
                          <path d="M7 11V7a5 5 0 019.9-1"/>
                        </svg>
                      )}
                    </button>
                    <button type="button" className="fs-map-edit-btn" onClick={() => { setRepositionPin(true); setMapLocked(false) }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                      </svg>
                      Edit location
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="fs-map-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c4c9d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>No coordinates set</div>
                <div className="fs-map-search fs-map-search-empty" ref={geoBoxRef}>
                  <svg className="fs-map-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input
                    type="text"
                    className="fs-map-search-input"
                    placeholder="Search location…"
                    value={geoQuery}
                    onChange={(e) => setGeoQuery(e.target.value)}
                  />
                  {geoLoading && <span className="fs-map-search-spin" />}
                  {geoResults.length > 0 && (
                    <div className="fs-map-search-results">
                      {geoResults.map((r, i) => (
                        <button key={i} type="button" className="fs-map-search-item" onClick={() => selectGeoResult(r)}>
                          {r.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location info */}
        <div className="card">
          <div className="card-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="sec-title" style={{ margin: 0 }}>Location</span>
              <button
                type="button"
                style={{ fontSize: 12, padding: '4px 14px', border: '1px solid var(--accent-bg)', color: 'var(--accent-bg)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: 'pointer' }}
                onClick={() => setEditingLocation(!editingLocation)}
              >
                {editingLocation ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingLocation ? (
              <div className="contract-grid">
                <div className="field">
                  <label>Address</label>
                  <input type="text" placeholder="Calle 58 #6-32" value={prop.address} onChange={(e) => setProp('address', e.target.value)} />
                </div>
                <div className="field">
                  <label>Neighbourhood</label>
                  <input type="text" placeholder="Chicó" value={prop.neighbourhood} onChange={(e) => setProp('neighbourhood', e.target.value)} />
                </div>
                <div className="field">
                  <label>City</label>
                  <input type="text" placeholder="Bogotá" value={prop.city} onChange={(e) => setProp('city', e.target.value)} />
                </div>
                <div className="field">
                  <label>Postal code</label>
                  <input type="text" placeholder="110221" value={prop.postalCode || ''} onChange={(e) => setProp('postalCode', e.target.value)} />
                </div>
                <div className="field">
                  <label>Country</label>
                  <select value={prop.country} onChange={(e) => setProp('country', e.target.value)}>
                    <option value="">Select...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Estrato/Grade</label>
                  <select
                    value={fs.estrato ?? ''}
                    onChange={(e) => set('estrato', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select...</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Latitude</label>
                  <input type="text" placeholder="4.711" value={prop.latitude ?? ''} onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || v === '-') setProp('latitude', undefined as unknown as number)
                    else { const n = parseFloat(v); if (!isNaN(n)) setProp('latitude', n) }
                  }} />
                </div>
                <div className="field">
                  <label>Longitude</label>
                  <input type="text" placeholder="-74.005" value={prop.longitude ?? ''} onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || v === '-') setProp('longitude', undefined as unknown as number)
                    else { const n = parseFloat(v); if (!isNaN(n)) setProp('longitude', n) }
                  }} />
                </div>
              </div>
            ) : (
              <div className="ct-fields">
                <ReadOnlyField label="Address" value={prop.address} />
                <ReadOnlyField label="Neighbourhood" value={prop.neighbourhood} />
                <ReadOnlyField label="City" value={prop.city} />
                <ReadOnlyField label="Postal code" value={prop.postalCode} />
                <ReadOnlyField label="Country" value={prop.country} />
                <ReadOnlyField label="Estrato/Grade" value={fs.estrato} />
                <ReadOnlyField label="Latitude" value={prop.latitude} />
                <ReadOnlyField label="Longitude" value={prop.longitude} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents (maps, floor plans, etc.) */}
      <div className="card mb24" style={{ overflow: 'hidden' }}>
        <div className="card-inner" style={{ padding: 0 }}>
          <input
            ref={docFileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            multiple
            hidden
            onChange={(e) => { addDocuments(e.target.files); e.target.value = '' }}
          />
          {uploadingDoc && documents.length === 0 ? (
            <div className="fs-doc-skeleton">
              <svg className="fs-photo-spinner" width="30" height="30" viewBox="0 0 90 90" fill="none">
                <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#0539FF"/>
                <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#0539FF"/>
                <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#0539FF"/>
                <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#0539FF"/>
              </svg>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>Uploading…</div>
            </div>
          ) : documents.length > 0 ? (
            <>
              <div className="fs-doc-header">
                <span className="sec-title" style={{ margin: 0 }}>Documents</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{documents.length} {documents.length === 1 ? 'file' : 'files'}</span>
                  <a className="fs-doc-dl-btn" href={documents[activeDoc] ?? documents[0]} download target="_blank" rel="noreferrer" title="Download">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                  <button type="button" className="fs-doc-add-btn" onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}>
                    {uploadingDoc ? 'Uploading…' : '+ Add'}
                  </button>
                </div>
              </div>
              <div className="fs-doc-viewer">
                {uploadingDoc && (
                  <div className="fs-photo-uploading-overlay">
                    <svg className="fs-photo-spinner" width="28" height="28" viewBox="0 0 90 90" fill="none">
                      <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#fff"/>
                      <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#fff"/>
                      <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#fff"/>
                      <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#fff"/>
                    </svg>
                    <div style={{ fontSize: 13, color: '#fff', marginTop: 8 }}>Uploading…</div>
                  </div>
                )}
                {isPdf(documents[activeDoc] ?? '') ? (
                  <iframe
                    className="fs-doc-pdf"
                    src={documents[activeDoc]}
                    title="Document"
                  />
                ) : (
                  <div
                    className="fs-doc-canvas"
                    ref={docViewerRef}
                    onPointerDown={handleDocPointerDown}
                    onPointerMove={handleDocPointerMove}
                    onPointerUp={handleDocPointerUp}
                  >
                    <img
                      className="fs-doc-img"
                      src={documents[activeDoc] ?? documents[0]}
                      alt="Document"
                      draggable={false}
                      style={{ transform: `translate(${docPan.x}px, ${docPan.y}px) scale(${docZoom})` }}
                    />
                  </div>
                )}
                {docZoom > 1 && !isPdf(documents[activeDoc] ?? '') && (
                  <div
                    className="fs-doc-minimap"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const cx = (e.clientX - rect.left) / rect.width   // 0..1
                      const cy = (e.clientY - rect.top) / rect.height   // 0..1
                      const viewerEl = docViewerRef.current
                      if (!viewerEl) return
                      const vw = viewerEl.clientWidth
                      const vh = viewerEl.clientHeight
                      // Pan so click point maps to center of viewport
                      setDocPan({
                        x: (0.5 - cx) * vw * docZoom,
                        y: (0.5 - cy) * vh * docZoom,
                      })
                    }}
                  >
                    <img src={documents[activeDoc] ?? documents[0]} alt="" draggable={false} />
                    <div
                      className="fs-doc-minimap-vp"
                      style={{
                        width: `${Math.min(100, 100 / docZoom)}%`,
                        height: `${Math.min(100, 100 / docZoom)}%`,
                        left: `${50 - (docPan.x / ((docViewerRef.current?.clientWidth ?? 1) * docZoom)) * 100}%`,
                        top: `${50 - (docPan.y / ((docViewerRef.current?.clientHeight ?? 1) * docZoom)) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>
                )}
                <div className="fs-doc-zoom-bar">
                  <button type="button" onClick={() => setDocZoom(z => Math.min(5, z + 0.25))} title="Zoom in">+</button>
                  <span className="fs-doc-zoom-label">{Math.round(docZoom * 100)}%</span>
                  <button type="button" onClick={() => setDocZoom(z => Math.max(0.5, z - 0.25))} title="Zoom out">−</button>
                  <button type="button" onClick={resetDocView} title="Fit to view">⊡</button>
                </div>
              </div>
              <div className="fs-photo-strip">
                {documents.map((src, i) => (
                  <div key={i} className={`fs-thumb${i === activeDoc ? ' active' : ''}`}>
                    {isPdf(src) ? (
                      <div className="fs-thumb-pdf" onClick={() => setActiveDoc(i)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>PDF</span>
                      </div>
                    ) : (
                      <img src={src} alt="" onClick={() => setActiveDoc(i)} />
                    )}
                    <button type="button" className="fs-thumb-del" onClick={() => removeDocument(i)}>×</button>
                  </div>
                ))}
                {uploadingDoc && (
                  <div className="fs-thumb fs-thumb-skeleton">
                    <div className="fs-thumb-shimmer" />
                  </div>
                )}
                <button type="button" className="fs-thumb-add" onClick={() => docFileRef.current?.click()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
            </>
          ) : (
            <div className="fs-doc-empty" onClick={() => !uploadingDoc && docFileRef.current?.click()}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c4c9d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>Upload documents</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Floor plans, maps, blueprints — JPEG, PNG or PDF</div>
            </div>
          )}
        </div>
      </div>

      {/* Ownership */}
      <div className="card mb24">
        <div className="card-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sec-title" style={{ margin: 0 }}>Ownership</span>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 14px', border: '1px solid var(--accent-bg)', color: 'var(--accent-bg)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setEditingOwnership(!editingOwnership)}
            >
              {editingOwnership ? 'Done' : 'Edit'}
            </button>
          </div>
          {editingOwnership ? (
            <div>
              {owners.map((o) => (
                <div key={o.id} className="contract-grid" style={{ marginBottom: 12, alignItems: 'end' }}>
                  <div className="field">
                    <label>Name</label>
                    <input type="text" placeholder="Juan Pérez" value={o.name} onChange={(e) => updateOwner(o.id, { name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>ID / NIT</label>
                    <input type="text" placeholder="80.123.456" value={o.idNumber} onChange={(e) => updateOwner(o.id, { idNumber: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Equity %</label>
                    <input type="text" placeholder="100" value={o.equityPct || ''} onChange={(e) => updateOwner(o.id, { equityPct: parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                  </div>
                  <div className="field" style={{ flex: 'none' }}>
                    <label>&nbsp;</label>
                    <button type="button" className="ghost danger" style={{ padding: '8px 10px' }} onClick={() => removeOwner(o.id)} title="Remove owner">×</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <button type="button" className="primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={addOwner}>+ Add owner</button>
                {owners.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: Math.abs(ownersTotalPct - 100) < 0.1 ? 'var(--green)' : '#b91c1c' }}>
                    Total: {ownersTotalPct.toFixed(ownersTotalPct % 1 ? 1 : 0)}%{Math.abs(ownersTotalPct - 100) >= 0.1 ? ' (should be 100%)' : ''}
                  </span>
                )}
              </div>
            </div>
          ) : (
            owners.length > 0 ? (
              <div>
                <div className="ct-fields">
                  {owners.map((o) => (
                    <ReadOnlyField key={o.id} label={o.name || '—'} value={`${o.equityPct}%${o.idNumber ? ` · ${o.idNumber}` : ''}`} />
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                  {owners.length} owner{owners.length !== 1 ? 's' : ''} · Total equity: {ownersTotalPct}%
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No owners registered</div>
            )
          )}
        </div>
      </div>

      {/* Mortgage */}
      <div className="card mb24">
        <div className="card-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sec-title" style={{ margin: 0 }}>Mortgage</span>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 14px', border: '1px solid var(--accent-bg)', color: 'var(--accent-bg)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setEditingMortgage(!editingMortgage)}
            >
              {editingMortgage ? 'Done' : 'Edit'}
            </button>
          </div>
          {editingMortgage ? (
            <div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Financing status</label>
                <select value={mortgage.hasMortgage ? 'yes' : 'no'} onChange={(e) => setMortgage('hasMortgage', e.target.value === 'yes')}>
                  <option value="no">No mortgage (outright owned)</option>
                  <option value="yes">Has mortgage</option>
                </select>
              </div>
              {mortgage.hasMortgage && (
                <div className="contract-grid">
                  <div className="field">
                    <label>Lender</label>
                    <input type="text" placeholder="Bancolombia" value={mortgage.lender} onChange={(e) => setMortgage('lender', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Loan number</label>
                    <input type="text" placeholder="Crédito hipotecario #" value={mortgage.loanNumber} onChange={(e) => setMortgage('loanNumber', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Rate type</label>
                    <select value={mortgage.rateType} onChange={(e) => setMortgage('rateType', e.target.value as 'fixed' | 'variable' | '')}>
                      <option value="">Select...</option>
                      <option value="fixed">Fixed (Tasa fija)</option>
                      <option value="variable">Variable (UVR)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Original amount ({prop.currency})</label>
                    <input type="text" placeholder="250,000,000" value={mortgage.originalAmount ?? ''} onChange={(e) => setMortgageNum('originalAmount', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Outstanding balance ({prop.currency})</label>
                    <input type="text" placeholder="180,000,000" value={mortgage.outstandingBalance ?? ''} onChange={(e) => setMortgageNum('outstandingBalance', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Monthly payment ({prop.currency})</label>
                    <input type="text" placeholder="2,500,000" value={mortgage.monthlyPayment ?? ''} onChange={(e) => setMortgageNum('monthlyPayment', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Interest rate</label>
                    <input type="text" placeholder="12.5" value={mortgage.interestRate ?? ''} onChange={(e) => setMortgage('interestRate', parseFloat(e.target.value.replace(/[^\d.]/g, '')) || null)} />
                    <span className="hint">% E.A.</span>
                  </div>
                  <div className="field">
                    <label>Term (months)</label>
                    <input type="text" placeholder="180" value={mortgage.termMonths ?? ''} onChange={(e) => setMortgageNum('termMonths', e.target.value)} />
                    {mortgage.termMonths ? <span className="hint">{(mortgage.termMonths / 12).toFixed(1)} years</span> : null}
                  </div>
                  <div className="field">
                    <label>Start date</label>
                    <input type="date" value={mortgage.startDate} onChange={(e) => setMortgage('startDate', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>End date</label>
                    <input type="date" value={mortgage.endDate} onChange={(e) => setMortgage('endDate', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            mortgage.hasMortgage ? (
              <div className="ct-fields">
                <ReadOnlyField label="Lender" value={mortgage.lender} />
                <ReadOnlyField label="Loan number" value={mortgage.loanNumber} />
                <ReadOnlyField label="Original amount" value={mortgage.originalAmount ? fmt(cx(mortgage.originalAmount)) : null} />
                <ReadOnlyField label="Outstanding balance" value={mortgage.outstandingBalance ? fmt(cx(mortgage.outstandingBalance)) : null} />
                <ReadOnlyField label="Monthly payment" value={mortgage.monthlyPayment ? fmt(cx(mortgage.monthlyPayment)) : null} />
                <ReadOnlyField label="Interest rate" value={mortgage.interestRate ? `${mortgage.interestRate}% E.A.` : null} />
                <ReadOnlyField label="Rate type" value={mortgage.rateType === 'fixed' ? 'Fixed (Tasa fija)' : mortgage.rateType === 'variable' ? 'Variable (UVR)' : null} />
                <ReadOnlyField label="Term" value={mortgage.termMonths ? `${mortgage.termMonths} months (${(mortgage.termMonths / 12).toFixed(1)} yrs)` : null} />
                <ReadOnlyField label="Start date" value={mortgage.startDate} />
                <ReadOnlyField label="End date" value={mortgage.endDate} />
              </div>
            ) : (
              <span className="badge rented" style={{ background: '#d1fae5', color: '#047857' }}>Outright owned</span>
            )
          )}
        </div>
      </div>

      {/* Legal & registration */}
      <div className="card mb24">
        <div className="card-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sec-title" style={{ margin: 0 }}>Legal & registration</span>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 14px', border: '1px solid var(--accent-bg)', color: 'var(--accent-bg)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setEditingLegal(!editingLegal)}
            >
              {editingLegal ? 'Done' : 'Edit'}
            </button>
          </div>
          {editingLegal ? (
            <div className="contract-grid">
              <div className="field">
                <label>Matrícula inmobiliaria</label>
                <input type="text" placeholder="001-123456" value={fs.matriculaInmobiliaria} onChange={(e) => set('matriculaInmobiliaria', e.target.value)} />
              </div>
              <div className="field">
                <label>Cédula catastral</label>
                <input type="text" placeholder="01-02-0304-0506-000" value={fs.cedulaCatastral} onChange={(e) => set('cedulaCatastral', e.target.value)} />
              </div>
              <div className="field">
                <label>CHIP</label>
                <input type="text" placeholder="AAA0000XXXX" value={fs.chip} onChange={(e) => set('chip', e.target.value)} />
              </div>
              <div className="field">
                <label>Custom ID</label>
                <input type="text" placeholder="" value={fs.customId} onChange={(e) => set('customId', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="ct-fields">
              <ReadOnlyField label="Matrícula inmobiliaria" value={fs.matriculaInmobiliaria} />
              <ReadOnlyField label="Cédula catastral" value={fs.cedulaCatastral} />
              <ReadOnlyField label="CHIP" value={fs.chip} />
              <ReadOnlyField label="Custom ID" value={fs.customId} />
            </div>
          )}
        </div>
      </div>

      {/* Valuation — hidden for now */}

      {/* Contacts */}
      <div className="sec-hdr mb12">
        <span className="sec-title">Contacts</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowContactForm(true)}
        >
          + Add contact
        </button>
      </div>

      {contacts.length === 0 && !showContactForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No contacts registered</div>
              <div className="fs12 text3 mt4">Add property managers, brokers, insurance contacts, and more</div>
              <button type="button" className="primary mt12" onClick={() => setShowContactForm(true)}>
                + Add first contact
              </button>
            </div>
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Role</th>
                <th style={{ textAlign: 'left' }}>Phone</th>
                <th style={{ textAlign: 'left' }}>Email</th>
                <th style={{ width: 64, textAlign: 'center' }}>
                  <button
                    className="ghost"
                    style={{ padding: 0, border: 'none', background: 'transparent', margin: '0 auto', display: 'block' }}
                    title={copied ? 'Copied!' : 'Copy table'}
                    onClick={handleCopy}
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="badge rented">{c.role}</span>
                  </td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{c.phone || '—'}</td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{c.email || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => startEditContact(c)}
                      title="Edit contact"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      style={{ padding: '4px 8px' }}
                      onClick={() => removeContact(c.id)}
                      title="Delete contact"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showContactForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingContactId ? 'Edit contact' : 'New contact'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  value={contactForm.name}
                  onChange={(e) => setContactField('name', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={contactForm.role} onChange={(e) => setContactField('role', e.target.value)}>
                  {CONTACT_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  type="text"
                  placeholder="+57 300 123 4567"
                  value={contactForm.phone}
                  onChange={(e) => setContactField('phone', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="juan@example.com"
                  value={contactForm.email}
                  onChange={(e) => setContactField('email', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button type="button" className="primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={editingContactId ? saveEditContact : addContact}>
                {editingContactId ? 'Save changes' : 'Add contact'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetContactForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="sec-hdr mb12">
        <span className="sec-title">Notes</span>
      </div>
      <div className="card">
        <div className="card-inner">
          <div className="field">
            <textarea
              rows={4}
              placeholder="Additional notes about this property..."
              value={fs.notes}
              onChange={(e) => set('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
