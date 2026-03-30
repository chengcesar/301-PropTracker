import { useState, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

// ─── helpers ────────────────────────────────────────────────────────────────

const pvLump = (fv, r, n) => fv / Math.pow(1 + r, n);

const pvAnnuity = (pmt, r, n) => {
  if (r === 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + r, -n)) / r;
};

const fmt = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
};

const fmtInput = (v) => (v === "" ? "" : String(v));

const STATUS = [
  {
    max: 0.80,
    label: "Serious risk",
    desc: "Portfolio is significantly underfunded. Reduce risk exposure and increase savings urgently.",
    strategy: "Focus on capital preservation and aggressive savings. Consider reducing discretionary goals.",
    accent: "#E24B4A",
    bg: "#FEF2F2",
    text: "#991B1B",
    badgeBg: "#FEE2E2",
  },
  {
    max: 0.95,
    label: "Fragile",
    desc: "Close to funded but vulnerable to market shocks. Monitor closely.",
    strategy: "Stay the course on your strategic asset allocation. Build an emergency buffer before increasing risk.",
    accent: "#D97706",
    bg: "#FFFBEB",
    text: "#92400E",
    badgeBg: "#FEF3C7",
  },
  {
    max: 1.10,
    label: "Stable",
    desc: "On track to meet your goals. Maintain your strategic asset allocation.",
    strategy: "Maintain your current allocation. Rebalance annually and review goals every 2–3 years.",
    accent: "#059669",
    bg: "#F0FDF4",
    text: "#065F46",
    badgeBg: "#D1FAE5",
  },
  {
    max: Infinity,
    label: "Strong surplus",
    desc: "Comfortably overfunded. You have room to take on more growth exposure.",
    strategy: "Consider increasing growth allocation, bringing aspirational goals forward, or gifting/philanthropy planning.",
    accent: "#2563EB",
    bg: "#EFF6FF",
    text: "#1E40AF",
    badgeBg: "#DBEAFE",
  },
];

const getStatus = (ratio) => STATUS.find((s) => ratio < s.max) ?? STATUS[3];

const PRIORITY_STYLES = {
  essential:    { bg: "#FEE2E2", text: "#991B1B", dot: "#E24B4A" },
  important:    { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
  aspirational: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
};

let _nextId = 3;

const DEFAULT_GOALS = [
  { id: 0, name: "Annual lifestyle", type: "annuity", year: 10, amount: 120000, priority: "essential" },
  { id: 1, name: "Property CAPEX",   type: "lump",   year: 5,  amount: 300000,  priority: "important" },
  { id: 2, name: "Retirement reserve", type: "lump", year: 10, amount: 1500000, priority: "essential" },
];

// ─── sub-components ──────────────────────────────────────────────────────────

function AssumptionInput({ label, value, onChange, step = 0.1, min = 0, max = 30 }) {
  return (
    <div style={{
      background: "#F8F8F6",
      borderRadius: 10,
      padding: "10px 14px",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid #E0DFD8",
            fontSize: 16,
            fontWeight: 500,
            color: "#1a1a1a",
            padding: "2px 0",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 13, color: "#aaa" }}>%</span>
      </div>
    </div>
  );
}

function GoalRow({ goal, pv, onUpdate, onRemove }) {
  const cell = { padding: "9px 8px 9px 0", borderBottom: "1px solid #F0EFE8", verticalAlign: "middle" };
  const inputStyle = {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid transparent",
    fontSize: 13,
    color: "#1a1a1a",
    padding: "2px 4px",
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  };
  const selStyle = { ...inputStyle, cursor: "pointer", fontSize: 12, color: "#555" };
  const ps = PRIORITY_STYLES[goal.priority];

  return (
    <tr>
      <td style={cell}>
        <input
          style={inputStyle}
          value={goal.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          onFocus={(e) => (e.target.style.borderBottomColor = "#aaa")}
          onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
        />
      </td>
      <td style={cell}>
        <select style={selStyle} value={goal.type} onChange={(e) => onUpdate("type", e.target.value)}>
          <option value="lump">Lump sum</option>
          <option value="annuity">Annuity</option>
        </select>
      </td>
      <td style={cell}>
        <input
          style={{ ...inputStyle, width: 50 }}
          type="number"
          min={1} max={50}
          value={goal.year}
          onChange={(e) => onUpdate("year", Number(e.target.value))}
          onFocus={(e) => (e.target.style.borderBottomColor = "#aaa")}
          onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
        />
      </td>
      <td style={cell}>
        <input
          style={inputStyle}
          type="number"
          min={0}
          step={1000}
          value={goal.amount}
          onChange={(e) => onUpdate("amount", Number(e.target.value))}
          onFocus={(e) => (e.target.style.borderBottomColor = "#aaa")}
          onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
        />
      </td>
      <td style={cell}>
        <select style={selStyle} value={goal.priority} onChange={(e) => onUpdate("priority", e.target.value)}>
          <option value="essential">Essential</option>
          <option value="important">Important</option>
          <option value="aspirational">Aspirational</option>
        </select>
      </td>
      <td style={{ ...cell, textAlign: "right", fontWeight: 500, fontSize: 13, color: "#1a1a1a", whiteSpace: "nowrap" }}>
        {fmt(pv)}
      </td>
      <td style={{ ...cell, textAlign: "center" }}>
        <button
          onClick={onRemove}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: "#ccc", padding: "0 4px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#E24B4A")}
          onMouseLeave={(e) => (e.target.style.color = "#ccc")}
        >✕</button>
      </td>
    </tr>
  );
}

function GaugeBar({ ratio }) {
  const pct = Math.min((ratio / 1.3) * 100, 100);
  const status = getStatus(ratio);
  const zones = [
    { pct: (0.80 / 1.3) * 100, color: "#FECACA" },
    { pct: (0.95 / 1.3) * 100, color: "#FDE68A" },
    { pct: (1.10 / 1.3) * 100, color: "#A7F3D0" },
    { pct: 100,                 color: "#BFDBFE" },
  ];

  return (
    <div style={{ margin: "4px 0 6px" }}>
      <div style={{ position: "relative", height: 10, borderRadius: 5, overflow: "hidden", display: "flex" }}>
        {zones.map((z, i) => {
          const prev = i === 0 ? 0 : zones[i - 1].pct;
          return (
            <div
              key={i}
              style={{ width: `${z.pct - prev}%`, background: z.color, height: "100%" }}
            />
          );
        })}
        {/* needle */}
        <div style={{
          position: "absolute",
          left: `calc(${Math.round(pct)}% - 2px)`,
          top: -2,
          width: 4,
          height: 14,
          background: status.accent,
          borderRadius: 2,
          transition: "left 0.5s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginTop: 4, padding: "0 1px" }}>
        <span>0%</span><span>80%</span><span>95%</span><span>110%</span><span>130%+</span>
      </div>
    </div>
  );
}

function BreakdownRow({ goal, pv, maxPv }) {
  const barW = maxPv > 0 ? Math.round((pv / maxPv) * 100) : 0;
  const ps = PRIORITY_STYLES[goal.priority];
  const barColor = ps.dot;
  const typeLabel = goal.type === "annuity" ? `annuity ×${goal.year}yr` : `yr ${goal.year}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, fontSize: 13 }}>
      <div style={{ flex: 1, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {goal.name}
      </div>
      <span style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 4,
        background: ps.bg, color: ps.text, whiteSpace: "nowrap",
      }}>{goal.priority}</span>
      <span style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap", minWidth: 70 }}>{typeLabel}</span>
      <div style={{ width: 80, height: 4, background: "#F0EFE8", borderRadius: 2, flexShrink: 0 }}>
        <div style={{ width: `${barW}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ fontWeight: 500, minWidth: 80, textAlign: "right", color: "#1a1a1a" }}>{fmt(pv)}</div>
    </div>
  );
}

// ─── cashflow chart ──────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  essential:    "#E24B4A",
  important:    "#D97706",
  aspirational: "#059669",
};

function buildCashflowData(goals, inflation) {
  if (!goals.length) return [];
  const maxYear = Math.max(...goals.map((g) => g.year), 1);
  const inf = (parseFloat(inflation) || 0) / 100;

  return Array.from({ length: maxYear }, (_, i) => {
    const yr = i + 1;
    const entry = { year: `Yr ${yr}` };
    goals.forEach((g) => {
      const inflated = Math.round(g.amount * Math.pow(1 + inf, yr));
      if (g.type === "annuity" && yr <= g.year) entry[g.name] = inflated;
      else if (g.type === "lump" && yr === g.year) entry[g.name] = inflated;
    });
    entry._total = goals.reduce((sum, g) => {
      const inflated = Math.round(g.amount * Math.pow(1 + inf, yr));
      if (g.type === "annuity" && yr <= g.year) return sum + inflated;
      if (g.type === "lump" && yr === g.year) return sum + inflated;
      return sum;
    }, 0);
    return entry;
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0);
  return (
    <div style={{
      background: "#fff", border: "1px solid #E8E8E0", borderRadius: 10,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <div style={{ fontWeight: 500, marginBottom: 6, color: "#111" }}>{label}</div>
      {items.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#555", marginBottom: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: "inline-block" }} />
            {p.dataKey}
          </span>
          <span style={{ fontWeight: 500, color: "#111" }}>{fmt(p.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div style={{ borderTop: "1px solid #F0EFE8", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 500, color: "#111" }}>
          <span>Total</span>
          <span>{fmt(items.reduce((s, p) => s + p.value, 0))}</span>
        </div>
      )}
    </div>
  );
};

function CashflowChart({ goals, inflation }) {
  const data = useMemo(() => buildCashflowData(goals, inflation), [goals, inflation]);
  if (!data.length) return null;

  const goalNames = goals.map((g) => g.name);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.07em", color: "#999", textTransform: "uppercase", marginBottom: 14 }}>
        Projected spending by year
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%" barGap={2} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#aaa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmt(v)}
            tick={{ fontSize: 11, fill: "#aaa" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8F8F6" }} />
          {goalNames.map((name, i) => {
            const goal = goals.find((g) => g.name === name);
            const color = PRIORITY_COLORS[goal?.priority] ?? "#888";
            const opacity = goal?.priority === "essential" ? 1 : goal?.priority === "important" ? 0.75 : 0.5;
            return (
              <Bar key={name} dataKey={name} stackId="a" fill={color} fillOpacity={opacity} radius={i === goalNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11, color: "#888" }}>
        {Object.entries(PRIORITY_COLORS).map(([p, color]) => (
          <span key={p} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
            {p}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "#bbb" }}>amounts grow at {inflation}% inflation · lump sums shown at target year</span>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function FundingRatioCalculator({ initialPortfolioValue = 2_000_000 }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [inflation, setInflation] = useState(3);
  const [expReturn, setExpReturn] = useState(6);
  const [portfolioValue, setPortfolioValue] = useState(initialPortfolioValue);

  // Real discount rate is always derived: Fischer equation
  const discountRate = (((1 + expReturn / 100) / (1 + inflation / 100)) - 1) * 100;

  const addGoal = () => {
    setGoals((prev) => [
      ...prev,
      { id: _nextId++, name: "New goal", type: "lump", year: 5, amount: 100_000, priority: "important" },
    ]);
  };

  const removeGoal = useCallback((id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const updateGoal = useCallback((id, field, val) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: val } : g)));
  }, []);

  // calculations
  const r = (parseFloat(discountRate) || 0) / 100;
  const rows = goals.map((g) => ({
    ...g,
    pv: g.type === "annuity" ? pvAnnuity(g.amount, r, g.year) : pvLump(g.amount, r, g.year),
  }));
  const totalPV = rows.reduce((s, r) => s + r.pv, 0);
  const ratio = totalPV > 0 ? portfolioValue / totalPV : 0;
  const gap = portfolioValue - totalPV;
  const maxPv = Math.max(...rows.map((r) => r.pv), 1);
  const status = getStatus(ratio);

  const sectionLabel = {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.07em",
    color: "#999",
    textTransform: "uppercase",
    margin: "0 0 12px",
  };

  const divider = {
    border: "none",
    borderTop: "1px solid #F0EFE8",
    margin: "24px 0",
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      maxWidth: 780,
      margin: "0 auto",
      padding: "28px 24px",
      color: "#1a1a1a",
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #EEEEE8",
    }}>
      {/* header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px", color: "#111" }}>
          Funding ratio
        </h2>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
          How much of your future goals is your portfolio covering today?
        </p>
      </div>

      {/* assumptions */}
      <p style={sectionLabel}>Assumptions</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <AssumptionInput label="Inflation rate" value={inflation} onChange={setInflation} />
        <AssumptionInput label="Expected return" value={expReturn} onChange={setExpReturn} />
        <div style={{ background: "#F8F8F6", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 130, opacity: 0.75 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Real discount rate <span style={{ fontSize: 10, color: "#bbb" }}>(auto)</span></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "#1a1a1a" }}>{discountRate.toFixed(2)}</span>
            <span style={{ fontSize: 13, color: "#aaa" }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>(1+return)/(1+inflation)−1</div>
        </div>
      </div>

      {/* goals table */}
      <p style={sectionLabel}>Goals</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <thead>
            <tr>
              {["Goal name", "Type", "Year", "Amount ($)", "Priority", "PV today", ""].map((h, i) => (
                <th key={i} style={{
                  fontSize: 11, fontWeight: 500, color: "#aaa", textAlign: "left",
                  padding: "0 8px 8px 0", borderBottom: "1px solid #F0EFE8",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                pv={g.pv}
                onUpdate={(field, val) => updateGoal(g.id, field, val)}
                onRemove={() => removeGoal(g.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addGoal}
        style={{
          fontSize: 12, color: "#2563EB",
          background: "none",
          border: "1px dashed #BFDBFE",
          borderRadius: 8,
          padding: "6px 16px",
          cursor: "pointer",
          marginTop: 10,
          marginBottom: 4,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.target.style.background = "#EFF6FF")}
        onMouseLeave={(e) => (e.target.style.background = "none")}
      >+ Add goal</button>

      <CashflowChart goals={goals} inflation={inflation} />

      {/* portfolio input */}
      <hr style={divider} />
      <p style={sectionLabel}>Current portfolio value</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#888" }}>Portfolio value ($)</span>
        <input
          type="number"
          value={portfolioValue}
          min={0}
          step={10000}
          onChange={(e) => setPortfolioValue(Number(e.target.value))}
          style={{
            border: "1px solid #E8E8E0",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 17,
            fontWeight: 500,
            color: "#111",
            background: "#FAFAF8",
            outline: "none",
            width: 200,
          }}
        />
        <span style={{ fontSize: 20, color: "#ccc", fontWeight: 300 }}>/</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 17, fontWeight: 500, color: "#888" }}>{fmt(totalPV)}</span>
          <span style={{ fontSize: 11, color: "#bbb" }}>total PV of goals</span>
        </div>
      </div>

      {/* results */}
      <hr style={divider} />

      {/* ratio hero */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1, color: status.accent, transition: "color 0.4s" }}>
          {Math.round(ratio * 100)}%
        </div>
        <div style={{ paddingBottom: 8 }}>
          <span style={{
            display: "inline-block",
            fontSize: 12, fontWeight: 500,
            background: status.badgeBg, color: status.text,
            borderRadius: 20, padding: "3px 12px",
            marginBottom: 4,
          }}>{status.label}</span>
          <div style={{ fontSize: 13, color: "#888" }}>Funding ratio</div>
        </div>
      </div>

      {/* gauge */}
      <GaugeBar ratio={ratio} />

      {/* metric cards */}
      <div style={{ display: "flex", gap: 10, margin: "20px 0", flexWrap: "wrap" }}>
        {[
          { label: "PV of goals", value: fmt(totalPV), color: "#1a1a1a" },
          { label: "Portfolio today", value: fmt(portfolioValue), color: "#1a1a1a" },
          { label: gap >= 0 ? "Surplus" : "Shortfall", value: (gap >= 0 ? "+" : "") + fmt(gap), color: gap >= 0 ? "#059669" : "#E24B4A" },
        ].map((m, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 110,
            background: "#F8F8F6",
            borderRadius: 10,
            padding: "12px 16px",
          }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 19, fontWeight: 500, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* goal breakdown */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 10 }}>
          Goal breakdown — present value
        </div>
        {rows.map((row) => (
          <BreakdownRow key={row.id} goal={row} pv={row.pv} maxPv={maxPv} />
        ))}
      </div>

      {/* strategy box */}
      <div style={{
        border: `1px solid ${status.accent}22`,
        background: status.bg,
        borderRadius: 12,
        padding: "14px 18px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: status.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Strategic implication
        </div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
          {status.strategy}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 20, fontSize: 11, color: "#aaa" }}>
        {[
          { dot: "#FECACA", label: "< 80% — serious risk" },
          { dot: "#FDE68A", label: "80–95% — fragile" },
          { dot: "#A7F3D0", label: "95–110% — stable" },
          { dot: "#BFDBFE", label: "> 110% — surplus" },
        ].map((l, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.dot, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
