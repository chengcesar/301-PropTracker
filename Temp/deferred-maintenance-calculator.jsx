import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { convert } from "../src/lib/currency";
import { estimatedPropertyValueAtYear, calcAnnual, convertAnnual } from "../src/lib/finance";

const fmt = (n) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n).toLocaleString()}`;

const pct = (n) => `${(n * 100).toFixed(1)}%`;

const CONDITION_PRESETS = [
  { label: "Good",     r: 1.15, d: 0.01, color: "#22c55e" },
  { label: "Fair",     r: 1.25, d: 0.02, color: "#f59e0b" },
  { label: "Poor",     r: 1.35, d: 0.03, color: "#ef4444" },
  { label: "Critical", r: 1.55, d: 0.06, color: "#b91c1c" },
];

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e8ecf2",
  borderRadius: 10,
  fontSize: 13,
  color: "#1a1d23",
};

export default function DeferredMaintenanceCalculator(props) {
  const { properties = [], displayCurrency = "USD", fxRates = null, year } = props || {};

  // Inputs
  const [assetValue, setAssetValue]     = useState(900000);
  const [capex, setCapex]               = useState(100000);
  const [monthlyRent, setMonthlyRent]   = useState(4500);
  const [expenseRatio, setExpenseRatio] = useState(0.38);
  const [holdYears, setHoldYears]       = useState(10);
  const [r, setR]                       = useState(1.35);   // multiplier rate
  const [d, setD]                       = useState(0.03);   // deterioration rate
  const [preset, setPreset]             = useState("Poor");
  const [contingency, setContingency]   = useState(0.20);

  // Current Asset Value source
  const [valueMode, setValueMode]             = useState("manual"); // "manual" | "portfolio"
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  const propertyOptions = useMemo(() => {
    const y = year ?? new Date().getFullYear();
    return properties
      .map(p => {
        const est = estimatedPropertyValueAtYear(p, y);
        if (est.value == null || est.value <= 0) return null;
        const value = fxRates ? convert(est.value, p.currency, displayCurrency, fxRates) : est.value;

        const annual = calcAnnual({ ...p, year: y });
        const annualIn = fxRates ? convertAnnual(annual, p.currency, displayCurrency, fxRates) : annual;
        const monthlyRent = annualIn.gpi > 0 ? annualIn.gpi / 12 : null;
        const expenseRatio = annualIn.egi > 0 ? Math.min(0.8, Math.max(0, annualIn.totalOpex / annualIn.egi)) : null;

        return { id: p.id, name: p.name, value, monthlyRent, expenseRatio };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [properties, displayCurrency, fxRates, year]);

  const applyPreset = (p) => {
    setPreset(p.label);
    setR(p.r);
    setD(p.d);
  };

  const annualRent = monthlyRent * 12;
  const noi        = annualRent * (1 - expenseRatio);
  const budgetedCapex = capex * (1 + contingency);

  const data = useMemo(() => {
    const rows = [];
    for (let t = 0; t <= holdYears; t++) {
      // Scenario A — do CapEx now
      const appRate   = 0.03;
      const valueA    = Math.min(assetValue * Math.pow(1 + appRate, t), assetValue * 1.35);
      const cumuNoiA  = t === 0 ? 0 : noi * t;
      const positionA = valueA + cumuNoiA - (t === 0 ? budgetedCapex : budgetedCapex);

      // Scenario B — defer
      const repairCost  = capex * Math.pow(r, t);
      const valueB      = assetValue * Math.pow(1 - d, t);
      const cumuNoiB    = 0; // no rent collected
      const positionB   = valueB - repairCost - cumuNoiB;
      const gap         = positionA - Math.max(positionB, 0);

      rows.push({
        year: t,
        repairCost,
        valueA: Math.round(valueA),
        positionA: Math.round(positionA),
        valueB: Math.round(Math.max(valueB, 0)),
        positionB: Math.round(Math.max(positionB, 0)),
        gap: Math.round(Math.max(gap, 0)),
        cumuNoiA: Math.round(cumuNoiA),
      });
    }
    return rows;
  }, [assetValue, capex, noi, holdYears, r, d, budgetedCapex]);

  const paybackYear = useMemo(() => {
    let cumNoi = 0;
    for (let t = 1; t <= holdYears; t++) {
      cumNoi += noi;
      if (cumNoi >= budgetedCapex) return t;
    }
    return null;
  }, [noi, budgetedCapex, holdYears]);

  const finalRow    = data[data.length - 1];
  const breakEvenRepair = data.find(r => r.repairCost >= r.valueB && r.year > 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .dmc-input-row { display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; }
        .dmc-input-row * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{ width: "100%" }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "16px 0 20px", lineHeight: 1.5 }}>
          Simulate the compounding cost of deferring CapEx vs. investing now — and find your budget limits.
        </p>

        {/* ── INPUT PANEL (top row) ── */}
        <div className="dmc-input-row">

            {/* Property Inputs */}
            <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#6b7280", margin: "0 0 16px" }}>Property</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Current Asset Value ($)</label>
                    {propertyOptions.length > 0 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => setValueMode("manual")}
                          style={{ ...toggleBtn, ...(valueMode === "manual" ? toggleBtnActive : {}) }}>
                          Manual
                        </button>
                        <button type="button" onClick={() => setValueMode("portfolio")}
                          style={{ ...toggleBtn, ...(valueMode === "portfolio" ? toggleBtnActive : {}) }}>
                          Portfolio
                        </button>
                      </div>
                    )}
                  </div>

                  {valueMode === "portfolio" && propertyOptions.length > 0 ? (
                    <>
                      <select
                        value={selectedPropertyId}
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedPropertyId(id);
                          const match = propertyOptions.find(o => String(o.id) === id);
                          if (!match) return;
                          setAssetValue(Math.round(match.value));
                          if (match.monthlyRent != null) setMonthlyRent(Math.round(match.monthlyRent));
                          if (match.expenseRatio != null) setExpenseRatio(match.expenseRatio);
                        }}
                        style={inputStyle}
                      >
                        <option value="" disabled>Select a property…</option>
                        {propertyOptions.map(o => (
                          <option key={o.id} value={o.id}>{o.name} — {fmt(o.value)}</option>
                        ))}
                      </select>
                      {selectedPropertyId && (
                        <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5 }}>
                          Prefilled from portfolio — value, monthly rent &amp; expense ratio below. Edit any field to override.
                        </p>
                      )}
                    </>
                  ) : (
                    <input type="number" value={assetValue} onChange={e => setAssetValue(+e.target.value)} style={inputStyle} />
                  )}
                </div>
                <Field label="CapEx Required ($)">
                  <input type="number" value={capex} onChange={e => setCapex(+e.target.value)} style={inputStyle} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
                <Field label="Monthly Rent ($)">
                  <input type="number" value={monthlyRent} onChange={e => setMonthlyRent(+e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Expense Ratio (%)">
                  <input type="number" value={Math.round(expenseRatio * 100)} onChange={e => setExpenseRatio(+e.target.value / 100)} style={inputStyle} min={0} max={80} />
                </Field>
                <Field label="Contingency Buffer (%)">
                  <input type="number" value={Math.round(contingency * 100)} onChange={e => setContingency(+e.target.value / 100)} style={inputStyle} min={0} max={50} />
                </Field>
              </div>

              <Field label="Hold Period" suffix="yrs">
                <input type="range" min={1} max={20} value={holdYears} onChange={e => setHoldYears(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>{holdYears} years</span>
              </Field>
            </div>

            {/* Multiplier Controls */}
            <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#6b7280", margin: "0 0 12px" }}>Asset Condition</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {CONDITION_PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p)}
                    style={{ ...presetBtn, background: preset === p.label ? p.color : "#f7f9fc", color: preset === p.label ? "#fff" : "#374151", borderColor: preset === p.label ? p.color : "#e8ecf2" }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <Field label="Deterioration Multiplier (r)" suffix="×">
                <input type="range" min={1.05} max={1.9} step={0.05} value={r} onChange={e => setR(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>{r.toFixed(2)}×/yr</span>
              </Field>
              <Field label="Asset Deterioration Rate (d, %)">
                <input type="range" min={0.5} max={10} step={0.5} value={d * 100} onChange={e => setD(+e.target.value / 100)} style={{ width: "100%", accentColor: "#3b82f6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>{pct(d)}/yr</span>
              </Field>

              <div style={{ marginTop: 16, padding: "12px 14px", background: "#f7f9fc", borderRadius: 10, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                <strong style={{ color: "#374151" }}>Formula:</strong><br />
                FRC = C × r<sup>t</sup><br />
                Value = V × (1−d)<sup>t</sup>
              </div>
            </div>
        </div>

        {/* ── RESULTS PANEL (below inputs) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, marginTop: 20 }}>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <KPI label="Budgeted CapEx" value={fmt(budgetedCapex)} sub={`incl. ${Math.round(contingency*100)}% contingency`} color="#3b82f6" />
              <KPI label="Annual NOI" value={fmt(noi)} sub={`${pct(1-expenseRatio)} margin`} color="#1BC5BD" />
              <KPI label="Cash Payback" value={paybackYear ? `${paybackYear} yrs` : ">hold period"} sub="CapEx recovered from NOI" color="#f59e0b" />
              <KPI label="10yr Total Position" value={fmt(finalRow.positionA)} sub="Scenario A (do CapEx)" color="#22c55e" />
              <KPI label="Cost of Full Deferral" value={fmt(finalRow.repairCost + finalRow.cumuNoiA)} sub={`at year ${holdYears}`} color="#b91c1c" />
              <KPI label="Decision Swing" value={fmt(finalRow.gap)} sub="A vs B at year end" color="#ec4899" />
            </div>

            {/* Chart — Position Over Time */}
            <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 4px" }}>Total Position Over Time</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px" }}>Asset value + cumulative NOI vs. deteriorating asset minus repair cost</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: "Years", position: "insideBottom", offset: -2, fontSize: 12 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmt(v), n]} labelFormatter={l => `Year ${l}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {paybackYear && <ReferenceLine x={paybackYear} stroke="#3b82f6" strokeDasharray="4 3" label={{ value: "Payback", fill: "#3b82f6", fontSize: 11 }} />}
                  <Line type="monotone" dataKey="positionA" name="Scenario A (CapEx now)" stroke="#1BC5BD" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="positionB" name="Scenario B (Deferred)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart — Repair Cost vs Asset Value */}
            <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 4px" }}>Repair Cost × Multiplier vs. Deteriorating Asset Value</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px" }}>
                Where these lines cross = <strong>functional insolvency</strong> — repair cost exceeds asset value
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: "Years", position: "insideBottom", offset: -2, fontSize: 12 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmt(v), n]} labelFormatter={l => `Year ${l}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="repairCost" name="Compounding Repair Cost" stroke="#b91c1c" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="valueB" name="Deteriorating Asset Value" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Year-by-Year Table */}
            <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>Year-by-Year Breakdown</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e8ecf2" }}>
                      {["Year","Repair Cost (B)","Asset Value (B)","Position A","Position B","Gap"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => {
                      const danger = row.repairCost >= row.valueB;
                      return (
                        <tr key={row.year} style={{ borderBottom: "1px solid #f3f4f6", background: danger ? "rgba(185,28,28,0.04)" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: danger ? "#b91c1c" : "#374151" }}>{row.year}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#b91c1c" }}>{fmt(row.repairCost)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#f59e0b" }}>{fmt(row.valueB)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#1BC5BD", fontWeight: 600 }}>{fmt(row.positionA)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: danger ? "#b91c1c" : "#6b7280" }}>{fmt(Math.max(row.positionB, 0))}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#3b82f6" }}>{fmt(row.gap)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {breakEvenRepair && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(185,28,28,0.06)", borderRadius: 10, borderLeft: "3px solid #b91c1c", fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>
                  ⚠️ Functional insolvency at <strong>Year {breakEvenRepair.year}</strong> — repair cost exceeds asset value. Do not defer past this point.
                </div>
              )}
            </div>

        </div>
      </div>
    </div>
  );
}

function Field({ label, prefix, suffix, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {prefix && <span style={{ fontSize: 13, color: "#6b7280" }}>{prefix}</span>}
        {children}
        {suffix && <span style={{ fontSize: 13, color: "#6b7280" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: "0 0 4px", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{sub}</p>
    </div>
  );
}

const inputStyle = {
  background: "#f7f9fc",
  border: "1px solid #e8ecf2",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: "#1a1d23",
  width: "100%",
  outline: "none",
};

const presetBtn = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const toggleBtn = {
  padding: "3px 9px",
  borderRadius: 7,
  border: "1px solid #e8ecf2",
  background: "#f7f9fc",
  color: "#6b7280",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const toggleBtnActive = {
  background: "#3b82f6",
  borderColor: "#3b82f6",
  color: "#fff",
};
