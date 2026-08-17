import { useState, useMemo, useEffect } from "react";
import { convert, resolveFunctionalCurrency } from "../src/lib/currency";
import { fmtCurrency } from "../src/lib/format";
import { estimatedPropertyValueAtYear, calcAnnual } from "../src/lib/finance";
import { CurrencySelect } from "../src/components/CurrencySelect";

const CONDITION_PRESETS = [
  { label: "Good", r: 1.15, d: 0.01, color: "#22c55e" },
  { label: "Fair", r: 1.25, d: 0.02, color: "#f59e0b" },
  { label: "Poor", r: 1.35, d: 0.03, color: "#ef4444" },
  { label: "Critical", r: 1.55, d: 0.06, color: "#b91c1c" },
];

export default function DeferredMaintenanceCalculatorV2(props) {
  const { properties = [], displayCurrency = "USD", fxRates = null, year } = props || {};

  // Property source
  const [valueMode, setValueMode] = useState("manual"); // "manual" | "portfolio"
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [functionalCurrency, setFunctionalCurrency] = useState(displayCurrency);

  // Raw inputs (in functionalCurrency)
  const [assetValue, setAssetValue] = useState(600000000);
  const [capex, setCapex] = useState(120000000);
  const [monthlyRent, setMonthlyRent] = useState(4500000);

  // Formula %
  const [contingencyPct, setContingencyPct] = useState(20);
  const [noiMarginPct, setNoiMarginPct] = useState(80);

  const [holdYears, setHoldYears] = useState(10);

  // Scenario assumptions
  const [preset, setPreset] = useState("Poor");
  const [r, setR] = useState(1.35);       // repair cost compounding multiplier
  const [d, setD] = useState(0.03);       // asset deterioration rate
  const [appreciationPct, setAppreciationPct] = useState(3);

  const propertyOptions = useMemo(() => {
    const y = year ?? new Date().getFullYear();
    return properties
      .map(p => {
        const est = estimatedPropertyValueAtYear(p, y);
        if (est.value == null || est.value <= 0) return null;
        const annual = calcAnnual({ ...p, year: y });
        const monthlyRentLocal = annual.gpi > 0 ? annual.gpi / 12 : null;
        return { id: p.id, name: p.name, value: est.value, monthlyRent: monthlyRentLocal, currency: resolveFunctionalCurrency(p) };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [properties, year]);

  useEffect(() => {
    if (valueMode !== "portfolio" || !selectedPropertyId) return;
    const match = propertyOptions.find(o => String(o.id) === selectedPropertyId);
    if (!match) return;
    setAssetValue(Math.round(match.value));
    if (match.monthlyRent != null) setMonthlyRent(Math.round(match.monthlyRent));
    if (match.currency) setFunctionalCurrency(match.currency);
  }, [valueMode, selectedPropertyId, propertyOptions]);

  const budgetedCapex = capex * (1 + contingencyPct / 100);
  const annualGrossRent = monthlyRent * 12;
  const annualNoi = annualGrossRent * (noiMarginPct / 100);

  const toUsd = (amount) => fxRates ? convert(amount, functionalCurrency, "USD", fxRates) : amount;

  const rows = [
    { label: "Asset Value", value: assetValue },
    { label: "CapEx to Activate or Maintain", value: capex },
    { label: `Budgeted CapEx (+${contingencyPct}%)`, value: budgetedCapex },
    { label: "Monthly Rent", value: monthlyRent },
    { label: "Annual Gross Rent", value: annualGrossRent },
    { label: `Annual NOI (${noiMarginPct}%)`, value: annualNoi },
  ];

  const applyPreset = (p) => {
    setPreset(p.label);
    setR(p.r);
    setD(p.d);
  };

  // Scenario A — do the CapEx now
  const cumulativeNoi = annualNoi * holdYears;
  const assetValueA = assetValue * Math.pow(1 + appreciationPct / 100, holdYears);
  const gainA = assetValueA - assetValue;
  const positionA = cumulativeNoi + assetValueA - budgetedCapex;

  // Scenario B — defer the CapEx
  const repairCostB = capex * Math.pow(r, holdYears);
  const assetValueB = Math.max(assetValue * Math.pow(1 - d, holdYears), 0);
  const lossB = assetValue - assetValueB;
  const positionB = assetValueB - repairCostB;

  const swing = positionA - positionB;
  const swingMultiple = assetValue > 0 ? Math.abs(swing) / assetValue : 0;

  const fmtDual = (amount) =>
    functionalCurrency === "USD"
      ? fmtCurrency(amount, "USD")
      : `${fmtCurrency(amount, functionalCurrency)} (≈ ${fmtCurrency(toUsd(amount), "USD")})`;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", width: "100%", boxSizing: "border-box" }}>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "16px 0 20px", lineHeight: 1.5 }}>
        Enter property figures in a functional currency and see the USD-equivalent breakdown.
      </p>

      <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#6b7280", margin: 0 }}>Property</p>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginBottom: 14 }}>
          {valueMode === "portfolio" && propertyOptions.length > 0 ? (
            <Field label="Select Property">
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                style={inputStyle}
              >
                <option value="" disabled>Select a property…</option>
                {propertyOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({fmtCurrency(o.value, o.currency)})</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Asset Value">
              <input type="number" value={assetValue} onChange={e => setAssetValue(+e.target.value)} style={inputStyle} />
            </Field>
          )}
          <Field label="Functional Currency">
            <CurrencySelect value={functionalCurrency} onChange={setFunctionalCurrency} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="CapEx to Activate or Maintain">
            <input type="number" value={capex} onChange={e => setCapex(+e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Contingency (%)">
            <input type="number" value={contingencyPct} onChange={e => setContingencyPct(+e.target.value)} style={inputStyle} min={0} max={100} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="Monthly Rent">
            <input type="number" value={monthlyRent} onChange={e => setMonthlyRent(+e.target.value)} style={inputStyle} />
          </Field>
          <Field label="NOI Margin (%)">
            <input type="number" value={noiMarginPct} onChange={e => setNoiMarginPct(+e.target.value)} style={inputStyle} min={0} max={100} />
          </Field>
        </div>

        <Field label="Asset Condition">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {CONDITION_PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => applyPreset(p)}
                style={{ ...presetBtn, padding: "10px 10px", background: preset === p.label ? p.color : "#f7f9fc", color: preset === p.label ? "#fff" : "#374151", borderColor: preset === p.label ? p.color : "#e8ecf2" }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Repair Cost Multiplier (r)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min={1.05} max={1.9} step={0.05} value={r} onChange={e => setR(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6", whiteSpace: "nowrap" }}>{r.toFixed(2)}×/yr</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Asset Deterioration Rate (d, %)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min={0.5} max={10} step={0.5} value={d * 100} onChange={e => setD(+e.target.value / 100)} style={{ width: "100%", accentColor: "#3b82f6" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6", whiteSpace: "nowrap" }}>{(d * 100).toFixed(1)}%/yr</span>
            </div>
          </div>

          <div style={{ padding: "12px 14px", background: "#f7f9fc", borderRadius: 10, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>Formula:</strong><br />
            FRC = C × r<sup>t</sup><br />
            Value = V × (1−d)<sup>t</sup>
          </div>
        </Field>

        <Field label="Appreciation Rate (%/yr)">
          <input type="number" value={appreciationPct} onChange={e => setAppreciationPct(+e.target.value)} style={inputStyle} min={0} max={20} step={0.5} />
        </Field>

        <Field label="Holding Period">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={2} max={20} value={holdYears} onChange={e => setHoldYears(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6", whiteSpace: "nowrap" }}>{holdYears} years</span>
          </div>
        </Field>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24, marginTop: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>Breakdown</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e8ecf2" }}>
                {["Metric", functionalCurrency, ...(functionalCurrency === "USD" ? [] : ["USD"])].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: h === "Metric" ? "left" : "right", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ padding: "8px 12px", color: "#374151" }}>{row.label}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#374151" }}>
                    {fmtCurrency(row.value, functionalCurrency)}
                  </td>
                  {functionalCurrency !== "USD" && (
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#1a1d23" }}>
                      {fmtCurrency(toUsd(row.value), "USD")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>
            What You Give Up <span style={{ color: "#1BC5BD" }}>(Scenario A — Do CapEx)</span>
          </p>
          <div style={{ background: "#f7f9fc", border: "1px solid #e8ecf2", borderRadius: 12, padding: "4px 18px" }}>
            <ScenarioLine label={`Budgeted CapEx (+${contingencyPct}%)`} value={`− ${fmtCurrency(budgetedCapex, functionalCurrency)}`} />
            <ScenarioLine label="Annual NOI" value={fmtCurrency(annualNoi, functionalCurrency)} />
            <ScenarioLine label={`Cumulative NOI (${holdYears} yrs)`} value={fmtCurrency(cumulativeNoi, functionalCurrency)} strong />
            <ScenarioLine label={`Appreciation Rate (${appreciationPct}%/yr)`} value={`${fmtCurrency(assetValue, functionalCurrency)} × (${(1 + appreciationPct / 100).toFixed(2)})^${holdYears}`} />
            <ScenarioLine label={<>Asset Value Yr{holdYears}<br />{`(Gain: +${fmtCurrency(gainA, functionalCurrency)})`}</>} value={fmtCurrency(assetValueA, functionalCurrency)} />
            <ScenarioLine
              label={<>Total {holdYears}yr Position<br />{`(${fmtCurrency(assetValueA, functionalCurrency)} + ${fmtCurrency(cumulativeNoi, functionalCurrency)} − ${fmtCurrency(budgetedCapex, functionalCurrency)})`}</>}
              value={fmtCurrency(positionA, functionalCurrency)} strong color="#1BC5BD" last
            />
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>
            What Happens If You Don't <span style={{ color: "#b91c1c" }}>(Scenario B — Defer)</span>
          </p>
          <div style={{ background: "#f7f9fc", border: "1px solid #e8ecf2", borderRadius: 12, padding: "4px 18px" }}>
            <ScenarioLine label={`Deferred Budgeted CapEx (+${contingencyPct}%)`} value={fmtCurrency(budgetedCapex, functionalCurrency)} />
            <ScenarioLine label={`Repair Cost Multiplier (r=${r})`} value={`${fmtCurrency(capex, functionalCurrency)} × ${r}^${holdYears}`} />
            <ScenarioLine label={`Repair Cost Yr${holdYears}`} value={fmtCurrency(repairCostB, functionalCurrency)} strong color="#b91c1c" />
            <ScenarioLine label={`Deterioration Rate (d=${Math.round(d * 100)}%)`} value={`${fmtCurrency(assetValue, functionalCurrency)} × ${(1 - d).toFixed(2)}^${holdYears}`} />
            <ScenarioLine label={<>Asset Value Yr{holdYears}<br />{`(Loss: −${fmtCurrency(lossB, functionalCurrency)})`}</>} value={fmtCurrency(assetValueB, functionalCurrency)} />
            <ScenarioLine
              label={<>Position Yr{holdYears}<br />{`(${fmtCurrency(assetValueB, functionalCurrency)} − ${fmtCurrency(repairCostB, functionalCurrency)})`}</>}
              value={fmtCurrency(positionB, functionalCurrency)} strong color="#b91c1c" last
            />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24, marginTop: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>The Total Loss Summary</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e8ecf2" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }} />
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 12, color: "#1BC5BD" }}>Scenario A</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 12, color: "#b91c1c" }}>Scenario B</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px 12px", color: "#374151" }}>{`Asset Value Yr${holdYears}`}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCurrency(assetValueA, functionalCurrency)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCurrency(assetValueB, functionalCurrency)}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px 12px", color: "#374151" }}>Cumulative NOI</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCurrency(cumulativeNoi, functionalCurrency)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCurrency(0, functionalCurrency)}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px 12px", color: "#374151" }}>CapEx Cost</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{`−${fmtCurrency(budgetedCapex, functionalCurrency)}`}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{`−${fmtCurrency(repairCostB, functionalCurrency)}`}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 12px", fontWeight: 700, color: "#1a1d23" }}>Net Position</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#1BC5BD" }}>{fmtCurrency(positionA, functionalCurrency)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{fmtCurrency(positionB, functionalCurrency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 16, padding: 24, marginTop: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", margin: "0 0 16px" }}>The Single Number</p>
        <div style={{ background: "#f7f9fc", border: "1px solid #e8ecf2", borderRadius: 12, padding: "4px 18px" }}>
          <ScenarioLine label={`Total Swing over ${holdYears} years (${fmtCurrency(positionA, functionalCurrency)} − ${fmtCurrency(positionB, functionalCurrency)})`} value={fmtCurrency(swing, functionalCurrency)} strong color="#3b82f6" last />
        </div>
        <p style={{ fontSize: 15, color: "#374151", margin: "16px 0 0", lineHeight: 1.6 }}>
          Deferring CapEx costs <strong>{fmtDual(Math.abs(swing))}</strong> more over {holdYears} years than acting now
          {swingMultiple >= 1 ? ` — nearly ${swingMultiple.toFixed(1)}× the current asset value.` : "."}
        </p>
      </div>
    </div>
  );
}

function ScenarioLine({ label, value, strong, color, last }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: last ? "none" : "1px solid #e8ecf2" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: strong ? 16 : 14, fontWeight: strong ? 700 : 600, color: color ?? "#1a1d23" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
      {children}
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
  flex: 1,
  padding: "8px 6px",
  borderRadius: 8,
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
