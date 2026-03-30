/**
 * RealEstateWidget — standalone, copy-pasteable component
 *
 * Only external dependency: recharts
 *   npm install recharts
 *
 * Usage:
 *
 *   // Financed / Mortgage
 *   <RealEstateWidget
 *     ownershipType="mortgage"
 *     purchasePrice={600000}
 *     downPayment={120000}
 *     termYears={30}
 *     interestRate={6.5}
 *     appreciation={4}
 *     purchaseDate="2022-06-01"
 *     currencySymbol="$"
 *   />
 *
 *   // Owned outright
 *   <RealEstateWidget
 *     ownershipType="owned"
 *     ownedSince="2015-01-01"
 *     ownedPurchasePrice={350000}
 *     ownedAppreciation={5}
 *     ownedProjectionYears={20}
 *     currencySymbol="$"
 *   />
 */

import { useState, useMemo } from 'react';
import {
  ComposedChart, AreaChart, Area, Bar, Cell, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, ReferenceLine,
} from 'recharts';

// ─── Math ──────────────────────────────────────────────────────────────────────

function computeMonthlyPayment(principal, monthlyRate, nMonths) {
  if (monthlyRate === 0) return principal / nMonths;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function buildAmortSchedule(loanAmount, annualRate, termYears, purchasePrice, appreciation, startYear) {
  const monthlyRate = annualRate / 12;
  const totalMonths = termYears * 12;
  const pmt = computeMonthlyPayment(loanAmount, monthlyRate, totalMonths);
  let balance = loanAmount;
  const yearly = [];
  let yearInterest = 0;
  let yearPrincipal = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const interest = balance * monthlyRate;
    const principal = pmt - interest;
    balance -= principal;
    if (balance < 0) balance = 0;
    yearInterest += interest;
    yearPrincipal += principal;

    if (m % 12 === 0) {
      const yearNum = m / 12;
      const year = startYear + yearNum - 1;
      const propertyValue = purchasePrice * Math.pow(1 + appreciation, yearNum);
      yearly.push({
        year,
        beginBalance: balance + yearPrincipal,
        principalPaid: yearPrincipal,
        interestPaid: yearInterest,
        endBalance: Math.max(balance, 0),
        totalPaid: yearPrincipal + yearInterest,
        propertyValue,
        equity: propertyValue - Math.max(balance, 0),
        cumulativeInterest: 0,
      });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }

  let cumInt = 0;
  yearly.forEach((r) => { cumInt += r.interestPaid; r.cumulativeInterest = cumInt; });

  return { yearly, monthlyPayment: pmt };
}

// ─── Formatters ────────────────────────────────────────────────────────────────

const fmt2 = (v, sym = '$') =>
  sym + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtK = (v, sym = '$') => {
  if (v >= 1_000_000) return sym + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return sym + (v / 1_000).toFixed(0) + 'K';
  return sym + Number(v).toFixed(0);
};

// ─── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  card: {
    background: '#fff',
    border: '1px solid #e8ecf2',
    borderRadius: 12,
    padding: '20px 24px',
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 16,
  },
  statRow: {
    display: 'flex', gap: 0, borderTop: '1px solid #f3f4f6', marginTop: 16,
  },
  stat: {
    flex: 1, padding: '14px 16px', borderRight: '1px solid #f3f4f6',
  },
  statLast: {
    flex: 1, padding: '14px 16px',
  },
  statLabel: {
    fontSize: 11, color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: '0.5px', fontWeight: 600, marginBottom: 4,
  },
  statVal: {
    fontSize: 16, fontWeight: 700, color: '#1a1d23',
  },
  autocalcRow: {
    display: 'flex', gap: 0, background: '#f0f7ff',
    borderRadius: 8, overflow: 'hidden', margin: '16px 0',
  },
  autocalcItem: {
    flex: 1, padding: '12px 16px', borderRight: '1px solid #dbeafe',
  },
  autocalcItemLast: {
    flex: 1, padding: '12px 16px',
  },
  autocalcLabel: {
    fontSize: 10, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.5px', fontWeight: 600, marginBottom: 3,
  },
  autocalcVal: {
    fontSize: 15, fontWeight: 700, color: '#1e40af',
  },
  pillRow: {
    display: 'flex', gap: 8, margin: '16px 0', justifyContent: 'center',
  },
  pill: (active) => ({
    padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${active ? '#3b82f6' : '#e8ecf2'}`,
    background: active ? '#eff6ff' : '#fff', color: active ? '#3b82f6' : '#9ca3af',
    transition: 'all 0.15s',
  }),
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280' },
  input: {
    padding: '9px 12px', fontSize: 14, border: '1px solid #e8ecf2',
    borderRadius: 8, background: '#fff', color: '#1a1d23', outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16, marginTop: 16,
  },
  btnSave: {
    padding: '10px 20px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    fontWeight: 600,
  },
  btnCancel: {
    padding: '10px 18px', background: '#fff', color: '#6b7280',
    border: '1px solid #e8ecf2', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  emptyState: {
    padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 13,
    border: '1px dashed #e8ecf2', borderRadius: 8, cursor: 'pointer',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: '#1a1d23', marginBottom: 0,
  },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  editBtn: {
    padding: '5px 14px', background: '#fff', color: '#3b82f6',
    border: '1px solid #3b82f6', borderRadius: 6, cursor: 'pointer', fontSize: 12,
    fontWeight: 600,
  },
  th: (left = false) => ({
    padding: '10px 16px',
    textAlign: left ? 'left' : 'right',
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    background: '#fafbfc', whiteSpace: 'nowrap',
    borderBottom: '2px solid #e8ecf2',
  }),
  td: (left = false, extra = {}) => ({
    padding: '11px 16px', textAlign: left ? 'left' : 'right',
    fontSize: 13, borderBottom: '1px solid #f3f4f6', ...extra,
  }),
};

// ─── Tooltips ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, sym = '$' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf2', borderRadius: 10,
      padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a1d23' }}>Year {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color ?? p.fill, marginBottom: 2 }}>
          {p.name}: <strong>{fmtK(p.value, sym)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Mortgage (Financed) Panel ─────────────────────────────────────────────────

function MortgagePanel({
  initialPurchasePrice = 500000,
  initialDownPayment = 150000,
  initialTermYears = 30,
  initialInterestRate = 6.5,
  initialAppreciation = 4,
  initialPurchaseDate = '',
  currencySymbol = '$',
}) {
  const today = new Date();
  const defaultDate = initialPurchaseDate ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [purchasePrice, setPurchasePrice] = useState(initialPurchasePrice);
  const [downPayment, setDownPayment] = useState(initialDownPayment);
  const [termYears, setTermYears] = useState(initialTermYears);
  const [interestRate, setInterestRate] = useState(initialInterestRate);
  const [appreciation, setAppreciation] = useState(initialAppreciation);
  const [purchaseDate, setPurchaseDate] = useState(defaultDate);
  const [propertyValueOverrides, setPropertyValueOverrides] = useState({});
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [editing, setEditing] = useState(false);
  const [hasData, setHasData] = useState(true);
  const [draft, setDraft] = useState(null);
  const [editingPropYear, setEditingPropYear] = useState(null);
  const [editingPropVal, setEditingPropVal] = useState('');
  const [schedCopied, setSchedCopied] = useState(false);

  const sym = currencySymbol;
  const loanAmount = Math.max(purchasePrice - downPayment, 0);
  const annualRate = interestRate / 100;
  const appRate = appreciation / 100;
  const startYear = purchaseDate
    ? new Date(purchaseDate + 'T12:00:00').getFullYear()
    : today.getFullYear();

  const { yearly, monthlyPayment } = useMemo(
    () => buildAmortSchedule(loanAmount, annualRate, termYears, purchasePrice, appRate, startYear),
    [loanAmount, annualRate, termYears, purchasePrice, appRate, startYear]
  );

  const yearlyDisplay = useMemo(() => yearly.map(r => {
    const ov = propertyValueOverrides[r.year];
    if (ov == null) return r;
    return { ...r, propertyValue: ov, equity: ov - r.endBalance };
  }), [yearly, propertyValueOverrides]);

  const calYear = today.getFullYear();
  const currentEntry = yearly.find(r => r.year === calYear)
    ?? (startYear > calYear ? yearly[0] : yearly[yearly.length - 1]);
  const totalInterest = yearly.length > 0 ? yearly[yearly.length - 1].cumulativeInterest : 0;
  const finalEquity = yearlyDisplay.length > 0 ? yearlyDisplay[yearlyDisplay.length - 1].equity : 0;
  const finalPropValue = yearlyDisplay.length > 0 ? yearlyDisplay[yearlyDisplay.length - 1].propertyValue : purchasePrice;
  const ltv = purchasePrice > 0 ? ((loanAmount / purchasePrice) * 100).toFixed(1) : '0.0';

  function startEdit() {
    setDraft({ purchasePrice, downPayment, termYears, interestRate, appreciation, purchaseDate });
    setEditing(true);
  }
  function cancelEdit() {
    if (draft) {
      setPurchasePrice(draft.purchasePrice); setDownPayment(draft.downPayment);
      setTermYears(draft.termYears); setInterestRate(draft.interestRate);
      setAppreciation(draft.appreciation); setPurchaseDate(draft.purchaseDate);
    }
    setEditing(false); setDraft(null);
  }
  function saveEdit() {
    setHasData(true); setEditing(false); setDraft(null);
  }

  function copyForExcel() {
    const headers = ['Year', 'Beg. Balance', 'Principal', 'Interest', 'End Balance', 'Property Value', 'Equity'];
    const rows = yearlyDisplay.map(r => [
      r.year,
      r.beginBalance.toFixed(2), r.principalPaid.toFixed(2),
      r.interestPaid.toFixed(2), r.endBalance.toFixed(2),
      r.propertyValue.toFixed(2), r.equity.toFixed(2),
    ]);
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setSchedCopied(true);
      setTimeout(() => setSchedCopied(false), 2000);
    });
  }

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.headerRow}>
        <div style={S.sectionTitle}>Mortgage Details</div>
        {hasData && !editing && (
          <button style={S.editBtn} onClick={startEdit}>Edit</button>
        )}
      </div>

      {/* Auto-calc summary bar */}
      {hasData && !editing && (
        <div style={S.autocalcRow}>
          {[
            { label: 'Loan Amount', val: fmtK(loanAmount, sym), sub: `${interestRate}% fixed · ${termYears}yr` },
            { label: 'Monthly Payment (P&I)', val: fmt2(monthlyPayment, sym), sub: `LTV ${ltv}%` },
            { label: 'Total Interest', val: fmtK(totalInterest, sym), sub: `${loanAmount > 0 ? ((totalInterest / loanAmount) * 100).toFixed(1) + '% of principal' : ''}`, valStyle: { color: '#b91c1c' } },
            { label: `Final Equity (Yr ${termYears})`, val: fmtK(finalEquity, sym), sub: `Property: ${fmtK(finalPropValue, sym)}`, valStyle: { color: '#0d9488' } },
            { label: 'Total Cost of Loan', val: fmtK(loanAmount + totalInterest, sym), sub: 'Principal + Interest' },
          ].map(({ label, val, sub, valStyle = {} }, i, arr) => (
            <div key={label} style={i < arr.length - 1 ? S.autocalcItem : S.autocalcItemLast}>
              <div style={S.autocalcLabel}>{label}</div>
              <div style={{ ...S.autocalcVal, ...valStyle }}>{val}</div>
              {sub && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <>
          <div style={S.formGrid}>
            {[
              { label: 'Purchase Date', type: 'date', value: purchaseDate, onChange: setPurchaseDate },
              { label: 'Purchase Price', type: 'number', value: purchasePrice, onChange: v => setPurchasePrice(Number(v) || 0), min: 0, step: 1000, prefix: sym },
              { label: 'Down Payment', type: 'number', value: downPayment, onChange: v => setDownPayment(Number(v) || 0), min: 0, step: 1000, prefix: sym },
              { label: 'Term (Years)', type: 'number', value: termYears, onChange: v => setTermYears(Math.max(1, Math.min(40, Number(v) || 1))), min: 1, max: 40, suffix: 'yr' },
              { label: 'Interest Rate', type: 'number', value: interestRate, onChange: v => setInterestRate(Number(v) || 0), min: 0, step: 0.1, suffix: '%' },
              { label: 'Annual Appreciation', type: 'number', value: appreciation, onChange: v => setAppreciation(Number(v) || 0), min: 0, step: 0.1, suffix: '%' },
            ].map(({ label, type, value, onChange, min, max, step, prefix, suffix }) => (
              <div key={label} style={S.field}>
                <label style={S.fieldLabel}>{label}</label>
                <div style={{ position: 'relative' }}>
                  {prefix && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>{prefix}</span>}
                  <input
                    type={type}
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={e => type === 'date' ? onChange(e.target.value) : onChange(e.target.value)}
                    style={{ ...S.input, paddingLeft: prefix ? 24 : 12, paddingRight: suffix ? 36 : 12 }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = '#e8ecf2')}
                  />
                  {suffix && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 12, pointerEvents: 'none' }}>{suffix}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={S.btnSave} onClick={saveEdit}>Save</button>
            <button style={S.btnCancel} onClick={cancelEdit}>Cancel</button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasData && !editing && (
        <div style={S.emptyState} onClick={startEdit}>
          No mortgage details added yet. Click to add details like purchase price, down payment, and more.
        </div>
      )}

      {/* Charts / Table */}
      {hasData && !editing && yearlyDisplay.length > 0 && (
        <>
          <div style={S.pillRow}>
            <button style={S.pill(view === 'chart')} onClick={() => setView('chart')}>Visual Breakdown</button>
            <button style={S.pill(view === 'table')} onClick={() => setView('table')}>Full Schedule</button>
          </div>

          {view === 'chart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Equity Growth chart */}
              <div style={{ background: '#fafbfc', border: '1px solid #f3f4f6', borderRadius: 12, padding: '20px 24px' }}>
                <div style={S.sectionLabel}>Equity Growth vs Remaining Debt</div>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={yearlyDisplay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={{ stroke: '#e8ecf2' }} />
                    <YAxis tickFormatter={v => fmtK(v, sym)} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<ChartTooltip sym={sym} />} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'inherit', paddingTop: 12 }} />
                    <ReferenceLine x={calYear} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3"
                      label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#3b82f6', fontFamily: 'inherit' }} />
                    <Area type="monotone" dataKey="equity" name="Equity" stroke="#1BC5BD" fill="rgba(27,197,189,0.12)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="endBalance" name="Remaining Debt" stroke="#b91c1c" fill="rgba(185,28,28,0.07)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="propertyValue" name="Property Value" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="6 4" dot={false} activeDot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Principal vs Interest bar chart */}
              <div style={{ background: '#fafbfc', border: '1px solid #f3f4f6', borderRadius: 12, padding: '20px 24px' }}>
                <div style={S.sectionLabel}>Annual Payment Breakdown — Principal vs Interest</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={yearlyDisplay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={{ stroke: '#e8ecf2' }} />
                    <YAxis tickFormatter={v => fmtK(v, sym)} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<ChartTooltip sym={sym} />} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'inherit', paddingTop: 12 }} />
                    <Bar dataKey="principalPaid" name="Principal" stackId="a" fill="#1BC5BD" radius={[0, 0, 0, 0]}>
                      {yearlyDisplay.map(r => (
                        <Cell key={r.year} fill="#1BC5BD" opacity={r.year <= calYear ? 0.5 : 0.85} />
                      ))}
                    </Bar>
                    <Bar dataKey="interestPaid" name="Interest" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]}>
                      {yearlyDisplay.map(r => (
                        <Cell key={r.year} fill="#f87171" opacity={r.year <= calYear ? 0.5 : 0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {view === 'table' && (
            <div style={{ background: '#fff', border: '1px solid #e8ecf2', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Year', 'Beg. Balance', 'Principal', 'Interest', 'End Balance', 'Property Value ✎', 'Equity'].map((h, i) => (
                        <th key={h} style={S.th(i === 0)}>{h}</th>
                      ))}
                      <th style={{ ...S.th(), cursor: 'pointer' }} title="Copy for Excel" onClick={copyForExcel}>
                        {schedCopied ? '✓' : '⎘'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyDisplay.map((r, i) => {
                      const ov = propertyValueOverrides[r.year];
                      const isEditingThis = editingPropYear === r.year;
                      function commitPropVal() {
                        const num = parseFloat(editingPropVal.replace(/[^0-9.]/g, ''));
                        if (!isNaN(num) && num > 0)
                          setPropertyValueOverrides(prev => ({ ...prev, [r.year]: num }));
                        setEditingPropYear(null); setEditingPropVal('');
                      }
                      return (
                        <tr key={r.year} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ ...S.td(true), fontWeight: 600, color: '#1a1d23' }}>{r.year}</td>
                          <td style={S.td(false, { color: '#374151' })}>{fmt2(r.beginBalance, sym)}</td>
                          <td style={S.td(false, { color: '#1BC5BD', fontWeight: 500 })}>{fmt2(r.principalPaid, sym)}</td>
                          <td style={S.td(false, { color: '#b91c1c', fontWeight: 500 })}>{fmt2(r.interestPaid, sym)}</td>
                          <td style={S.td(false, { color: '#374151' })}>{fmt2(r.endBalance, sym)}</td>
                          <td
                            style={{ ...S.td(), cursor: 'pointer' }}
                            title="Click to override"
                            onClick={() => { if (!isEditingThis) { setEditingPropYear(r.year); setEditingPropVal(String(r.propertyValue.toFixed(2))); } }}
                          >
                            {isEditingThis ? (
                              <input autoFocus type="number" value={editingPropVal}
                                onChange={e => setEditingPropVal(e.target.value)}
                                onBlur={commitPropVal}
                                onKeyDown={e => { if (e.key === 'Enter') commitPropVal(); if (e.key === 'Escape') { setEditingPropYear(null); setEditingPropVal(''); } }}
                                style={{ width: 120, textAlign: 'right', padding: '3px 6px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #3b82f6', borderRadius: 6, background: '#fff', color: '#1a1d23', outline: 'none' }}
                                onClick={e => e.stopPropagation()} />
                            ) : (
                              <span style={{ color: ov ? '#3b82f6' : '#9ca3af' }}>
                                {fmt2(r.propertyValue, sym)}
                                {ov && (
                                  <button title="Reset" onClick={e => { e.stopPropagation(); setPropertyValueOverrides(prev => { const n = { ...prev }; delete n[r.year]; return n; }); }}
                                    style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 10, padding: 0 }}>✕</button>
                                )}
                              </span>
                            )}
                          </td>
                          <td style={S.td(false, { color: '#1BC5BD', fontWeight: 700 })}>{fmt2(r.equity, sym)}</td>
                          <td style={S.td()} />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e8ecf2', background: '#fafbfc' }}>
                      <td style={{ ...S.td(true), fontWeight: 700, color: '#1a1d23' }}>TOTAL</td>
                      <td style={S.td(false, { color: '#9ca3af' })}>—</td>
                      <td style={S.td(false, { color: '#1BC5BD', fontWeight: 700 })}>{fmt2(loanAmount, sym)}</td>
                      <td style={S.td(false, { color: '#b91c1c', fontWeight: 700 })}>{fmt2(totalInterest, sym)}</td>
                      <td style={S.td(false, { color: '#374151', fontWeight: 700 })}>{sym}0.00</td>
                      <td style={S.td(false, { color: '#9ca3af' })}>—</td>
                      <td style={S.td(false, { color: '#1BC5BD', fontWeight: 700 })}>{fmt2(yearlyDisplay[yearlyDisplay.length - 1]?.equity ?? finalEquity, sym)}</td>
                      <td style={S.td()} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding: '8px 16px', fontSize: 11, color: '#9ca3af' }}>
                Debt follows loan terms · Property value assumes {appreciation}% annual appreciation · P&I only (excludes taxes, insurance, PMI)
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Owned Outright Panel ──────────────────────────────────────────────────────

function OwnedPanel({
  initialOwnedSince = '',
  initialPurchasePrice = 0,
  initialAppreciation = 5,
  initialProjectionYears = 15,
  currencySymbol = '$',
}) {
  const today = new Date();
  const defaultSince = initialOwnedSince || `${today.getFullYear()}-01-01`;

  const [ownedSince, setOwnedSince] = useState(defaultSince);
  const [purchasePrice, setPurchasePrice] = useState(initialPurchasePrice);
  const [appreciation, setAppreciation] = useState(initialAppreciation);
  const [projectionYears, setProjectionYears] = useState(initialProjectionYears);
  const [overrides, setOverrides] = useState({});
  const [hasData, setHasData] = useState(initialPurchasePrice > 0);
  const [editing, setEditing] = useState(initialPurchasePrice === 0);
  const [editingYear, setEditingYear] = useState(null);
  const [editingVal, setEditingVal] = useState('');
  const [copied, setCopied] = useState(false);

  const sym = currencySymbol;

  const yearlyBase = useMemo(() => {
    if (purchasePrice <= 0) return [];
    const startYear = new Date(ownedSince + 'T12:00:00').getFullYear();
    const calYear = today.getFullYear();
    const minYears = calYear - startYear;
    const effectiveYears = Math.max(projectionYears, minYears);
    const appRate = appreciation / 100;
    const result = [];
    for (let y = startYear; y <= startYear + effectiveYears; y++) {
      result.push({ year: y, propertyValue: purchasePrice * Math.pow(1 + appRate, y - startYear) });
    }
    return result;
  }, [purchasePrice, ownedSince, appreciation, projectionYears]);

  const yearly = useMemo(() => {
    if (yearlyBase.length === 0) return [];
    const startYear = new Date(ownedSince + 'T12:00:00').getFullYear();
    const appRate = appreciation / 100;
    let baseYear = startYear;
    let baseValue = purchasePrice;
    return yearlyBase.map(r => {
      if (overrides[r.year] != null) {
        baseYear = r.year; baseValue = overrides[r.year];
        return { ...r, propertyValue: baseValue };
      }
      return { ...r, propertyValue: baseValue * Math.pow(1 + appRate, r.year - baseYear) };
    });
  }, [yearlyBase, overrides, appreciation, purchasePrice, ownedSince]);

  const calYear = today.getFullYear();
  const currentEntry = yearly.find(r => r.year === calYear) ?? (yearly.length > 0 ? yearly[yearly.length - 1] : null);
  const currentVal = currentEntry?.propertyValue ?? 0;
  const firstVal = yearly[0]?.propertyValue ?? 0;
  const gain = currentVal - firstVal;
  const gainPct = firstVal > 0 ? (gain / firstVal) * 100 : 0;

  function saveEdit() { setHasData(true); setEditing(false); }

  function copyForExcel() {
    const headers = ['Year', 'Property Value', 'Change %'];
    const rows = yearly.map((r, i) => {
      const prev = yearly[i - 1];
      const chg = prev ? (((r.propertyValue - prev.propertyValue) / prev.propertyValue) * 100).toFixed(1) + '%' : '';
      return [r.year, r.propertyValue.toFixed(2), chg];
    });
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  const pastData = yearly.filter(r => r.year <= calYear);
  const chartData = pastData.length >= 2 ? pastData : yearly;

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div style={S.sectionTitle}>Price History (Yearly)</div>
        {hasData && !editing && <button style={S.editBtn} onClick={() => setEditing(true)}>Edit</button>}
      </div>

      {/* Edit form */}
      {editing && (
        <>
          <div style={S.formGrid}>
            {[
              { label: 'Owned Since', type: 'date', value: ownedSince, onChange: setOwnedSince },
              { label: 'Purchase Price', type: 'number', value: purchasePrice, onChange: v => setPurchasePrice(Number(v) || 0), min: 0, step: 1000, prefix: sym },
              { label: 'Annual Appreciation', type: 'number', value: appreciation, onChange: v => setAppreciation(Number(v) || 0), min: 0, step: 0.1, suffix: '%' },
              { label: 'Years of Projection', type: 'number', value: projectionYears, onChange: v => setProjectionYears(Math.max(1, Math.min(100, Number(v) || 15))), min: 1, max: 100, suffix: 'yr' },
            ].map(({ label, type, value, onChange, min, max, step, prefix, suffix }) => (
              <div key={label} style={S.field}>
                <label style={S.fieldLabel}>{label}</label>
                <div style={{ position: 'relative' }}>
                  {prefix && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>{prefix}</span>}
                  <input type={type} value={value} min={min} max={max} step={step}
                    onChange={e => type === 'date' ? onChange(e.target.value) : onChange(e.target.value)}
                    style={{ ...S.input, paddingLeft: prefix ? 24 : 12, paddingRight: suffix ? 36 : 12 }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = '#e8ecf2')} />
                  {suffix && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 12, pointerEvents: 'none' }}>{suffix}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={S.btnSave} onClick={saveEdit}>Save</button>
            {hasData && <button style={S.btnCancel} onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasData && !editing && (
        <div style={S.emptyState} onClick={() => setEditing(true)}>
          No price history yet. Click to add purchase price and appreciation to generate a value schedule.
        </div>
      )}

      {/* Summary stats */}
      {hasData && !editing && yearly.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, marginBottom: 8 }}>
            {[
              { label: 'Purchase Price', val: fmtK(purchasePrice, sym) },
              { label: 'Current Value', val: fmtK(currentVal, sym) },
              { label: 'Appreciation', val: `${appreciation}% / yr` },
              { label: 'Value Gain', val: `${gain >= 0 ? '+' : ''}${fmtK(Math.abs(gain), sym)}`, color: gain >= 0 ? '#0d9488' : '#b91c1c' },
              { label: 'Total Return', val: `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`, color: gainPct >= 0 ? '#0d9488' : '#b91c1c' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex: '1 1 120px', background: '#f8fafc', border: '1px solid #f3f4f6', borderRadius: 8, padding: '12px 16px' }}>
                <div style={S.autocalcLabel}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: color || '#1a1d23', marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Mini area chart */}
          {chartData.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ownedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={v => fmtK(v, sym)} tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'inherit' }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<ChartTooltip sym={sym} />} />
                  <Area type="monotone" dataKey="propertyValue" name="Property Value" stroke="#3b82f6" strokeWidth={2} fill="url(#ownedGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Yearly table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'inherit' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8ecf2' }}>
                  <th style={S.th(true)}>Year</th>
                  <th style={S.th()}>Property Value ✎</th>
                  <th style={S.th()}>Change</th>
                  <th style={{ ...S.th(), cursor: 'pointer' }} title="Copy for Excel" onClick={copyForExcel}>{copied ? '✓' : '⎘'}</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((r, i) => {
                  const isPast = r.year <= calYear;
                  const ov = overrides[r.year];
                  const prev = yearly[i - 1];
                  const changePct = prev ? ((r.propertyValue - prev.propertyValue) / prev.propertyValue) * 100 : null;
                  const isEditingThis = editingYear === r.year;

                  function commitVal() {
                    const num = parseFloat(editingVal.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num) && num > 0) setOverrides(prev => ({ ...prev, [r.year]: num }));
                    setEditingYear(null); setEditingVal('');
                  }

                  return (
                    <tr key={r.year} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafbfc', opacity: isPast ? 1 : 0.6 }}>
                      <td style={{ ...S.td(true), fontWeight: 600, color: '#1a1d23' }}>{r.year}</td>
                      <td style={{ ...S.td(), cursor: 'pointer' }}
                        title="Click to override"
                        onClick={() => { if (!isEditingThis) { setEditingYear(r.year); setEditingVal(String(r.propertyValue.toFixed(2))); } }}>
                        {isEditingThis ? (
                          <input autoFocus type="number" value={editingVal}
                            onChange={e => setEditingVal(e.target.value)}
                            onBlur={commitVal}
                            onKeyDown={e => { if (e.key === 'Enter') commitVal(); if (e.key === 'Escape') { setEditingYear(null); setEditingVal(''); } }}
                            style={{ width: 120, textAlign: 'right', padding: '3px 6px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #3b82f6', borderRadius: 6, background: '#fff', color: '#1a1d23', outline: 'none' }}
                            onClick={e => e.stopPropagation()} />
                        ) : (
                          <span style={{ color: ov != null ? '#3b82f6' : '#374151' }}>
                            {fmt2(r.propertyValue, sym)}
                            {ov != null && (
                              <button title="Reset" onClick={e => { e.stopPropagation(); setOverrides(p => { const n = { ...p }; delete n[r.year]; return n; }); }}
                                style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 10, padding: 0 }}>✕</button>
                            )}
                          </span>
                        )}
                      </td>
                      <td style={S.td()}>
                        {changePct == null
                          ? <span style={{ color: '#d1d5db' }}>—</span>
                          : <span style={{ color: changePct >= 0 ? '#0d9488' : '#b91c1c' }}>{changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%</span>
                        }
                      </td>
                      <td style={S.td()} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {'mortgage'|'owned'} props.ownershipType         - Which panel to show
 * @param {string}  [props.currencySymbol='$']             - Prefix symbol for all monetary values
 *
 * Mortgage-specific:
 * @param {number}  [props.purchasePrice=500000]
 * @param {number}  [props.downPayment=150000]
 * @param {number}  [props.termYears=30]
 * @param {number}  [props.interestRate=6.5]               - As a percentage, e.g. 6.5 for 6.5%
 * @param {number}  [props.appreciation=4]                 - Annual appreciation %, e.g. 4
 * @param {string}  [props.purchaseDate]                   - ISO date string, e.g. "2020-01-15"
 *
 * Owned-outright-specific:
 * @param {string}  [props.ownedSince]                     - ISO date string, e.g. "2015-06-01"
 * @param {number}  [props.ownedPurchasePrice=0]
 * @param {number}  [props.ownedAppreciation=5]
 * @param {number}  [props.ownedProjectionYears=15]
 */
export default function RealEstateWidget({
  ownershipType = 'mortgage',
  currencySymbol = '$',
  // mortgage props
  purchasePrice,
  downPayment,
  termYears,
  interestRate,
  appreciation,
  purchaseDate,
  // owned props
  ownedSince,
  ownedPurchasePrice,
  ownedAppreciation,
  ownedProjectionYears,
}) {
  const containerStyle = {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#1a1d23',
    maxWidth: 900,
  };

  if (ownershipType === 'owned') {
    return (
      <div style={containerStyle}>
        <OwnedPanel
          initialOwnedSince={ownedSince}
          initialPurchasePrice={ownedPurchasePrice}
          initialAppreciation={ownedAppreciation}
          initialProjectionYears={ownedProjectionYears}
          currencySymbol={currencySymbol}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <MortgagePanel
        initialPurchasePrice={purchasePrice}
        initialDownPayment={downPayment}
        initialTermYears={termYears}
        initialInterestRate={interestRate}
        initialAppreciation={appreciation}
        initialPurchaseDate={purchaseDate}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
