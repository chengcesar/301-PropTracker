import { useState, useRef, useEffect } from 'react'
import { type CurrencyCode, CURRENCIES, CURRENCY_LIST, flagUrl } from '../lib/currency'

type Props = {
  value: CurrencyCode | ''
  onChange: (c: CurrencyCode) => void
  /** For <label htmlFor="…"> association */
  buttonId?: string
}

export function CurrencySelect({ value, onChange, buttonId }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setSearch('')
      inputRef.current?.focus()
    }
  }, [open])

  const filtered = CURRENCY_LIST.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    const cfg = CURRENCIES[c]
    return c.toLowerCase().includes(q) || cfg.label.toLowerCase().includes(q)
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '9px 32px 9px 12px',
          fontSize: 15,
          background: '#f7f9fc',
          border: '1px solid #e8ecf2',
          borderRadius: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
          position: 'relative',
          color: value ? '#1a1d23' : '#9ca3af',
        }}
      >
        {value ? (
          <img src={flagUrl(value, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span style={{ width: 22, height: 16, flexShrink: 0 }} aria-hidden />
        )}
        <span style={{ fontWeight: 500 }}>{value || 'Select currency...'}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: `translateY(-50%)${open ? ' rotate(180deg)' : ''}`,
            transition: 'transform 0.15s ease',
          }}
          aria-hidden
        >
          <path d="M1 1l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e8ecf2',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 50,
            animation: 'selectSlideIn 0.15s ease-out',
            overflow: 'hidden',
          }}
          role="listbox"
        >
          <div style={{ padding: '10px 10px 6px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: 13,
                background: '#f7f9fc',
                border: '1px solid #e8ecf2',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map((code) => {
              const cfg = CURRENCIES[code]
              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={value === code}
                  className="ghost"
                  onClick={() => {
                    onChange(code)
                    setOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 0,
                    background: value === code ? '#f0f5ff' : undefined,
                  }}
                >
                  <img src={flagUrl(code, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    {code} ({cfg.symbol})
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
