import { useState } from 'react'
import {
  ACCENT_HEX_BY_PRESET,
  ACCENT_PRESETS,
  ACCENT_TOKEN_ROWS,
  getStoredAccent,
  setAccentPreset,
  type AccentPreset,
} from '../lib/accentTheme'

/**
 * Internal reference for PropTracker UI tokens and patterns.
 * Available only to users with Firestore users/{uid}.role === "admin".
 */
export default function AdminDesignSystemPage() {
  const [accent, setAccent] = useState<AccentPreset>(() => getStoredAccent())

  function selectAccent(id: AccentPreset) {
    setAccentPreset(id)
    setAccent(id)
  }

  return (
    <div className="admin-page-inner">
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>
          Design system
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text3)', margin: '6px 0 0', lineHeight: 1.5 }}>
          CSS variables and core components from{' '}
          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text2)' }}>design-system.css</code>.
          Default accent tokens live on <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text2)' }}>:root</code>.
          Non-blue presets apply the same <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text2)' }}>--accent-*</code> values on{' '}
          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text2)' }}>&lt;html&gt;</code> (inline + <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text2)' }}>data-accent</code>) so they win over stylesheet order.
        </p>
      </header>

      <div className="card">
        <div className="card-inner">
          <h2 className="admin-ds-section-title" style={{ marginTop: 0 }}>
            Accent &amp; brand (central tokens)
          </h2>

          <div
            className="admin-accent-preset-toggle admin-ds-row"
            style={{ marginBottom: 16, gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
            role="radiogroup"
            aria-label="Accent preset"
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>Active preset</span>
            {ACCENT_PRESETS.map((p) => (
              <label
                key={p.id}
                className="admin-accent-preset-option"
                title={p.hint}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: accent === p.id ? 600 : 500,
                  color: accent === p.id ? 'var(--accent-bg)' : 'var(--text2)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${accent === p.id ? 'var(--accent-bg)' : 'var(--border)'}`,
                  background: accent === p.id ? 'var(--accent-subtle-bg)' : 'var(--surface)',
                }}
              >
                <input
                  type="radio"
                  name="propflow-accent-preset"
                  value={p.id}
                  checked={accent === p.id}
                  onChange={() => selectAccent(p.id)}
                  style={{ accentColor: 'var(--accent-bg)', cursor: 'pointer' }}
                />
                {p.label}
              </label>
            ))}
          </div>
          <p className="admin-ds-note" style={{ marginTop: 0, marginBottom: 16 }}>
            Applies to the whole app for this browser; stored as <code style={{ fontSize: 12 }}>localStorage</code> (
            <code style={{ fontSize: 12 }}>propflow-accent</code>). Add more presets in{' '}
            <code style={{ fontSize: 12 }}>design-system.css</code> (<code style={{ fontSize: 12 }}>html[data-accent=&quot;…&quot;]</code>) and{' '}
            <code style={{ fontSize: 12 }}>accentTheme.ts</code>.
          </p>

          <p className="admin-ds-note" style={{ marginBottom: 12 }}>
            <strong>Naming:</strong> Cyan uses preset id <code style={{ fontSize: 12 }}>teal</code> in code and{' '}
            <code style={{ fontSize: 12 }}>localStorage</code> (<code style={{ fontSize: 12 }}>data-accent=&quot;teal&quot;</code>); Terracotta uses id{' '}
            <code style={{ fontSize: 12 }}>terracotta</code> (base <code style={{ fontSize: 12 }}>#6d2f20</code>).
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table className="admin-ds-token-table">
              <thead>
                <tr>
                  <th>Swatch</th>
                  <th>Variable</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                {ACCENT_TOKEN_ROWS.map((row) => (
                    <tr key={row.varName}>
                      <td style={{ minWidth: 280 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {ACCENT_PRESETS.map((p) => {
                            const hex = ACCENT_HEX_BY_PRESET[p.id][row.varName]
                            return (
                              <div key={p.id} className="admin-ds-row" style={{ gap: 8, alignItems: 'center' }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: 'var(--text3)',
                                    width: 72,
                                    flexShrink: 0,
                                  }}
                                >
                                  {p.label}
                                </span>
                                <div className="admin-ds-swatch" style={{ background: hex }} title={hex} />
                                <code style={{ fontSize: 12 }}>{hex}</code>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                      <td>
                        <code>{row.varName}</code>
                      </td>
                      <td style={{ color: 'var(--text2)', minWidth: 200 }}>{row.usage}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-ds-note" style={{ marginBottom: 0 }}>
            <strong>Live:</strong> components below read <code style={{ fontSize: 12 }}>var(--accent-…)</code> from the active preset — currently{' '}
            <strong>
              {accent === 'blue'
                ? 'Blue (:root)'
                : accent === 'teal'
                  ? 'Cyan (preset teal / inline on html)'
                  : 'Terracotta (preset terracotta / inline on html)'}
            </strong>
            . The table lists all preset reference palettes (Swatch → Variable → Usage).
          </p>
          <p className="admin-ds-note">
            Logo marks use separate brand colors (e.g. header SVG); app chrome accent follows these tokens.
          </p>

          <h2 className="admin-ds-section-title">Neutrals &amp; semantic</h2>
          <table className="admin-ds-token-table">
            <thead>
              <tr>
                <th>Swatch</th>
                <th>Variable</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {[
                { v: '--bg', u: 'App / page background' },
                { v: '--surface', u: 'Cards, header, sidebar' },
                { v: '--surface2', u: 'Subtle fills, hovers' },
                { v: '--border', u: 'Default borders' },
                { v: '--text', u: 'Primary text' },
                { v: '--text3', u: 'Labels, meta' },
                { v: '--green', u: 'Positive / rented' },
                { v: '--red', u: 'Destructive / loss' },
                { v: '--amber', u: 'Warning' },
                { v: '--purple', u: 'Overrides / info accent' },
              ].map((row) => (
                <tr key={row.v}>
                  <td>
                    <div className="admin-ds-swatch" style={{ background: `var(${row.v})` }} title={row.v} />
                  </td>
                  <td>
                    <code>{row.v}</code>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{row.u}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin-ds-section-title">Typography</h2>
          <div className="admin-ds-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              KPI / heading 20px bold
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Section label 14px semibold</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Body 13px — default UI copy</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Meta 11px uppercase
            </div>
          </div>

          <h2 className="admin-ds-section-title">Buttons</h2>
          <div className="admin-ds-row">
            <button type="button">Default</button>
            <button type="button" className="primary">
              Primary
            </button>
            <button type="button" className="ghost">
              Ghost
            </button>
            <button type="button" className="danger">
              Danger
            </button>
            <button type="button" className="warning">
              Warning
            </button>
            <button type="button" disabled>
              Disabled
            </button>
          </div>

          <h2 className="admin-ds-section-title">Form controls</h2>
          <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
            <input type="text" placeholder="Text input" aria-label="Sample text input" />
            <select aria-label="Sample select">
              <option>Option one</option>
              <option>Option two</option>
            </select>
            <label className="admin-ds-row" style={{ gap: 8, fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" defaultChecked /> Checkbox (accent)
            </label>
          </div>

          <h2 className="admin-ds-section-title">Badges</h2>
          <div className="admin-ds-row">
            <span className="badge rented">Rented</span>
            <span className="badge vacant">Vacant</span>
            <span className="badge override">Override</span>
            <span className="badge draft-c">Draft</span>
          </div>

          <h2 className="admin-ds-section-title">KPI cards</h2>
          <div className="kpi-row" style={{ marginBottom: 0 }}>
            <div className="kpi-card">
              <div className="kpi-label">Sample KPI</div>
              <div className="kpi-value">$1,240,000</div>
              <div className="kpi-sub">Sub label</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">With delta</div>
              <div className="kpi-value green">+2.4%</div>
              <div className="kpi-delta-pill kpi-delta-pill--up">Up</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Risk</div>
              <div className="kpi-value red">−1.1%</div>
            </div>
          </div>

          <h2 className="admin-ds-section-title">Tabs &amp; year control</h2>
          <div className="tabs" style={{ padding: '12px 0 0', marginBottom: 12 }}>
            <button type="button" className="tab-btn active">
              Active
            </button>
            <button type="button" className="tab-btn">
              Inactive
            </button>
          </div>
          <div className="admin-ds-row">
            <button type="button" className="year-btn active">
              2026
            </button>
            <button type="button" className="year-btn">
              2025
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
