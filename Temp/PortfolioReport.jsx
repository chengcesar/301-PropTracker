/**
 * PortfolioReport.jsx
 *
 * Drop inside your reserved modal. Pass your existing properties array directly.
 *
 *   <PortfolioReport properties={properties} year={selectedYear} />
 *
 * The normalise() function maps your dashboard object fields automatically.
 * Edit the aliases there if your keys differ slightly.
 */

import { useState, useRef } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { doc, updateDoc, increment } from "firebase/firestore";
import { auth, firestore } from "../src/lib/firebase";

// ─── normalise one property object ───────────────────────────────────────────
function norm(p) {
  const f = (...keys) => { for (const k of keys) if (p[k] != null && p[k] !== "") return p[k]; return null; };
  const n = (...keys) => { const v = f(...keys); return v == null ? null : parseFloat(v) || 0; };

  const area  = n("area","Area (m²)","areaSqm") || 1;
  const gpi   = n("gpi","GPI (USD)") || 0;
  const egi   = n("egi","EGI (USD)") || 0;
  const opex  = Math.abs(n("opex","OPEX (USD)") || 0);
  const noi   = n("noi","NOI (USD)") || 0;
  const capex = Math.abs(n("capex","CAPEX (USD)") || 0);
  const taxes = Math.abs(n("taxes","Taxes (USD)") || 0);
  const netCF = n("netCF","netcf","Net CF (USD)") || 0;
  const value = n("estimatedValue","value","Est. value (USD)","estValue") || 0;
  const debt  = Math.abs(n("debt","Debt (USD)") || 0);

  return {
    name:      f("name","property","Property") || "Unknown",
    owner:     f("owner","Owner") || "",
    country:   f("country","Country") || "",
    status:    f("status","Status") || "",
    monthsLeft: n("monthsLeft","Months Left"),
    taxStatus: f("taxStatus","Tax Status") || "",
    pendingTaxItems: Array.isArray(p.pendingTaxItems) ? p.pendingTaxItems : [],
    type:      f("type","Type") || "",
    beds:      n("beds","Beds"),
    area, gpi, egi, opex, noi, capex, taxes, netCF, value, debt,
    margin:    n("margin","Margin"),
    capRate:   n("capRate","Cap rate %","capRatePct"),
    yoy:       n("yoy","Value YoY %","valueYoY"),
    vacRate:   n("vacRate","Vacancy mo rate %"),
    equity:    value - debt,
    rentM2:    gpi  / area,
    noiM2:     noi  / area,
    valueM2:   value / area,
    capexM2:   capex > 0 ? capex / area : null,
    capexEff:  capex > 0 ? (noi / area) / (capex / area) : null,
  };
}

// ─── formatters ──────────────────────────────────────────────────────────────
const $   = (v, d=0) => v == null || isNaN(v) ? "—" : `$${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d})}`;
const pct = (v, d=1) => v == null || isNaN(v) ? "—" : `${Number(v).toFixed(d)}%`;
const n2  = (v, d=1) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const clr = (v) => (v == null || isNaN(v)) ? "#6b7280" : v >= 0 ? "#0d9488" : "#b91c1c";

/** ≥8% → High yield (8–10% band); 6–8% → Balanced; 4–6% → Stable; <4% → Low yield */
const capRateYieldLabel = (cap) => {
  if (cap == null || isNaN(cap)) return "—";
  if (cap >= 8) return "High yield";
  if (cap >= 6) return "Balanced";
  if (cap >= 4) return "Stable";
  return "Low yield";
};

const COLORS = ["#3b82f6","#1BC5BD","#f59e0b","#8b5cf6","#ec4899","#10b981","#f97316","#6366f1"];

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function HBar({ value, max, color="#3b82f6" }) {
  const w = max ? Math.max(0, Math.min(100, (Math.abs(value) / Math.abs(max)) * 100)) : 0;
  return (
    <div style={{ height:6, background:"#e8ecf2", borderRadius:4, overflow:"hidden", marginTop:3, WebkitPrintColorAdjust:"exact", printColorAdjust:"exact" }}>
      <div style={{ height:"100%", width:`${w}%`, background:color, borderRadius:4, WebkitPrintColorAdjust:"exact", printColorAdjust:"exact" }} />
    </div>
  );
}

// ─── Column chart ─────────────────────────────────────────────────────────────
function ColChart({ items, height=95, label="" }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1);
  const N = items.length || 1;
  const labelSize = Math.max(5, Math.min(9, Math.floor(45 / N)));
  const nameSize  = Math.max(5, Math.min(8, Math.floor(40 / N)));
  return (
    <div>
      {label && <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:8}}>{label}</div>}
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height}}>
        {items.map((d,i)=>{
          const pct = (Math.abs(d.value)/max)*100;
          const valLabel = Math.abs(d.value)>=1000?`$${(d.value/1000).toFixed(0)}k`:`$${d.value.toFixed(0)}`;
          return (
            <div key={d.name} style={{flex:1,height:`${pct}%`,minWidth:0,position:"relative",background:d.color||"#93c5fd",borderRadius:"3px 3px 0 0",opacity:0.92,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
              <div style={{position:"absolute",bottom:"100%",left:0,right:0,textAlign:"center",fontSize:labelSize,fontWeight:700,color:d.color||"#6b7280",marginBottom:2,lineHeight:1,whiteSpace:"nowrap"}}>{valLabel}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:4,marginTop:5}}>
        {items.map(d=>(
          <div key={d.name} style={{flex:1,fontSize:nameSize,color:"#6b7280",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>
            {d.name.slice(0,10)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Waterfall ────────────────────────────────────────────────────────────────
function Waterfall({ gpi, vacLoss, opex, taxes, netCF }) {
  const rows = [
    { label:"GPI",        value: gpi,    color:"#3b82f6" },
    { label:"− Vacancy",  value:-vacLoss, color:"#f59e0b" },
    { label:"− OPEX",     value:-opex,   color:"#f87171" },
    { label:"− Taxes",    value:-taxes,  color:"#c084fc" },
    { label:"Net Cash Flow", value:netCF, color: netCF>=0?"#10b981":"#b91c1c", bold:true },
  ];
  const max = Math.max(...rows.map(r=>Math.abs(r.value)),1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {rows.map(r=>(
        <div key={r.label}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#374151",marginBottom:2}}>
            <span style={{fontWeight:r.bold?700:400}}>{r.label}</span>
            <span style={{fontWeight:700,color:r.value>=0?"#1a1d23":"#b91c1c"}}>
              {r.value<0?`(${$(Math.abs(r.value))})`:`${$(r.value)}`}
            </span>
          </div>
          <HBar value={Math.abs(r.value)} max={max} color={r.color}/>
        </div>
      ))}
    </div>
  );
}

const AI_TEXT_KEY = "portfolio-ai-report-text";

// ─── AI narrative ─────────────────────────────────────────────────────────────
function useAISection(properties, agg, currencyLabel="USD", onPaywall) {
  const [text, setText]       = useState(() => localStorage.getItem(AI_TEXT_KEY) || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);

  async function generate() {
    if (onPaywall && onPaywall()) return;  // returns true = blocked
    setLoading(true); setErr(null);
    try {
      const snapshot = properties.map(p=>({
        name:p.name, status:p.status, type:p.type, area:p.area,
        gpi:p.gpi, egi:p.egi, opex:p.opex, noi:p.noi, netCF:p.netCF,
        capex:p.capex, taxes:p.taxes,
        capRate:p.capRate, yoy:p.yoy, monthsLeft:p.monthsLeft,
        taxStatus:p.taxStatus, margin:p.margin, vacRate:p.vacRate,
        rentM2:+p.rentM2.toFixed(1), noiM2:+p.noiM2.toFixed(1),
        valueM2:+p.valueM2.toFixed(0), value:p.value, debt:p.debt,
        capexEff: p.capexEff!=null ? +p.capexEff.toFixed(2) : null,
      }));

      const sorted = {
        byRentM2:   [...properties].sort((a,b)=>b.rentM2-a.rentM2).map(p=>p.name),
        byNOIM2:    [...properties].sort((a,b)=>b.noiM2-a.noiM2).map(p=>p.name),
        byCapRate:  [...properties].filter(p=>p.capRate!=null).sort((a,b)=>b.capRate-a.capRate).map(p=>p.name),
        byOPEX:     [...properties].sort((a,b)=>b.opex-a.opex).map(p=>p.name),
        byNetCF:    [...properties].sort((a,b)=>b.netCF-a.netCF).map(p=>p.name),
        byValueM2:  [...properties].sort((a,b)=>b.valueM2-a.valueM2).map(p=>p.name),
        expiringSoon: properties.filter(p=>p.monthsLeft!=null&&p.monthsLeft<=6&&p.status==="Rented").map(p=>({name:p.name,monthsLeft:p.monthsLeft,rentM2:+p.rentM2.toFixed(1),gpi:p.gpi})),
        vacant:       properties.filter(p=>p.status==="Vacant").map(p=>({name:p.name,monthlyCost:+Math.abs(p.netCF/12).toFixed(0)})),
        highOPEX:     properties.filter(p=>p.opex>0).sort((a,b)=>b.opex-a.opex).slice(0,3).map(p=>({name:p.name,opex:p.opex,opexPctGPI:p.gpi>0?+((p.opex/p.gpi)*100).toFixed(1):null})),
        rentBelowM2avg: properties.filter(p=>p.rentM2 < (agg.rentM2Port*0.85) && p.status==="Rented").map(p=>({name:p.name,rentM2:+p.rentM2.toFixed(1),portfolioAvgRentM2:+agg.rentM2Port.toFixed(1)})),
      };

      const thePrompt = `You are a senior real estate portfolio analyst writing a private report for the portfolio owner.

Portfolio data (${currencyLabel}, annual):
${JSON.stringify({totals:agg, properties:snapshot, crossPropertyRankings:sorted},null,2)}

Write a professional analyst commentary using this exact structure. Be specific with real numbers at every point. No generic advice. No filler.

**Executive Summary**
2-3 sentences on overall portfolio health, total NOI, net cash flow, and the single most important insight.

**Highlights**
5-6 bullet points surfacing the most interesting cross-property facts. Each bullet should be a concrete, specific callout — not generic. Cover things like:
- Which unit generates the highest rent/m² and how it compares to the rest
- Which property has the best NOI/m² and what makes it stand out vs its peers
- Efficiency comparisons: e.g. a large property generating less NOI/m² than a smaller one, or a renovated unit where CAPEX investment hasn't yet translated to income
- The biggest expense line in the portfolio (property name + OPEX amount + % of its GPI)
- Upcoming contract renewals and the rent negotiation opportunity they represent (name the property, months left, current rent/m², and whether it is below portfolio average)
- Any property where rent/m² is below the portfolio average and a rent increase is warranted
- Any vacancy dragging the portfolio with its monthly cost
Start each bullet with a specific emoji that matches its theme (💰 for rent, 📐 for efficiency, 🔧 for costs, 📅 for contracts, 🏠 for vacancy, 📈 for performance, etc.)

**Strengths**
3 bullet points. Bold the property name or metric. One sentence of insight with specific figures each.

**Weaknesses & Risks**
3 bullet points. Cover vacancy drag, negative NOI, low cap rates, expiring contracts, pending taxes. Use numbers.

**Recommended Actions**
4 numbered items. Each must name a specific property and a specific action. Examples of the level of specificity required: "Renegotiate Apto 108's contract at renewal in 4 months — current rent/m² of $X is 20% below portfolio average"; "Review OPEX on Apto 102 — at $Y/year it exceeds its GPI with no rent income"; "Target rent increase of 10-15% on Apto 128 at next IPC adjustment". No vague advice.

**Outlook**
2 sentences on portfolio trajectory given current occupancy, contract pipeline, and value trends.

Tone: direct, confident, professional. Think like a fund manager writing to a sophisticated owner who wants real insight, not reassurance. No markdown code blocks.`;
      const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1400,
        messages: [{ role: "user", content: thePrompt }],
      });
      const rawText = message.content.find(b => b.type === "text")?.text || "";
      localStorage.setItem(AI_TEXT_KEY, rawText);
      setText(rawText);
      if (auth?.currentUser && firestore) {
        updateDoc(doc(firestore, "users", auth.currentUser.uid), {
          "usage.aiGenerations": increment(1),
        }).catch(() => {});
      }
    } catch { setErr("Could not load analysis. Please try again."); }
    setLoading(false);
  }

  return { text, loading, err, generate };
}

function AISection({ text, loading, err, generate }) {
  function render(raw) {
    return raw.split("\n").map((line,i)=>{
      if (!line.trim()) return <div key={i} style={{height:7}}/>;
      if (/^\*\*(.+)\*\*$/.test(line.trim())) return (
        <div key={i} style={{fontSize:11,fontWeight:700,color:"#1a1d23",textTransform:"uppercase",letterSpacing:"0.8px",marginTop:16,marginBottom:5,borderBottom:"1px solid #e8ecf2",paddingBottom:4}}>
          {line.trim().replace(/\*\*/g,"")}
        </div>
      );
      if (/^[-•]/.test(line.trim())) return (
        <div key={i} style={{display:"flex",gap:8,fontSize:12,color:"#374151",lineHeight:1.7,marginBottom:3}}>
          <span style={{color:"#1a1d23",flexShrink:0}}>•</span>
          <span dangerouslySetInnerHTML={{__html:line.trim().replace(/^[-•]\s*/,"").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}}/>
        </div>
      );
      if (/^\d+\./.test(line.trim())) return (
        <div key={i} style={{display:"flex",gap:8,fontSize:12,color:"#374151",lineHeight:1.7,marginBottom:3}}>
          <span style={{color:"#1a1d23",fontWeight:700,flexShrink:0,minWidth:14}}>{line.trim().match(/^\d+/)[0]}.</span>
          <span dangerouslySetInnerHTML={{__html:line.trim().replace(/^\d+\.\s*/,"").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}}/>
        </div>
      );
      return <p key={i} style={{fontSize:12,color:"#374151",lineHeight:1.75,margin:"0 0 3px"}} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}}/>;
    });
  }

  if (loading) return (
    <div style={{textAlign:"center",padding:"36px 0",color:"#6b7280",fontSize:13}}>
      <img className="fs-photo-spinner" src="/App-Icon.svg" alt="" width={32} height={32} style={{marginBottom:12,display:"block",margin:"0 auto 12px"}}/>
      Analysing your portfolio…
    </div>
  );
  if (!text) return (
    <>
      <div className="no-print" style={{textAlign:"center",padding:"30px 0"}}>
        <button
          onClick={generate}
          disabled={loading}
          style={{background:"var(--accent-bg,#3b82f6)",border:"none",borderRadius:8,padding:"8px 20px",fontSize:13,color:"#fff",cursor:"pointer",fontWeight:600,fontFamily:"inherit",marginBottom:12}}
        >
          Generate Analysis
        </button>
        <div style={{fontSize:13,color:"#6b7280"}}>AI-powered interpretation of your portfolio data</div>
        {err && <div style={{color:"#b91c1c",fontSize:12,marginTop:10}}>{err}</div>}
      </div>
      <div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic",display:"none"}} className="print-only-placeholder">
        AI analysis not yet generated. Open the report and click "Generate Analysis" before printing.
      </div>
    </>
  );
  return (
    <div>
      {render(text)}
      {err && <div style={{color:"#b91c1c",fontSize:12,marginTop:10}}>{err}</div>}
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function PortfolioReport({ properties: rawProps = [], year, displayCurrency, onBack, onPaywall }) {
  const printRef = useRef();
  const props = rawProps.map(norm);

  // aggregates
  const totalValue = props.reduce((s,p)=>s+p.value,0);
  const totalGPI   = props.reduce((s,p)=>s+p.gpi,0);
  const totalEGI   = props.reduce((s,p)=>s+p.egi,0);
  const totalOPEX  = props.reduce((s,p)=>s+p.opex,0);
  const totalNOI   = props.reduce((s,p)=>s+p.noi,0);
  const totalTaxes = props.reduce((s,p)=>s+p.taxes,0);
  const totalNetCF = props.reduce((s,p)=>s+p.netCF,0);
  const totalArea  = props.reduce((s,p)=>s+p.area,0);
  const totalDebt  = props.reduce((s,p)=>s+p.debt,0);
  const vacLoss    = totalGPI - totalEGI;
  const rented     = props.filter(p=>p.status==="Rented");
  const portCapRate= totalValue>0?(totalNOI/totalValue)*100:0;
  const occupancy  = props.length?(rented.length/props.length)*100:0;
  const noiMargin  = totalEGI>0?(totalNOI/totalEGI)*100:0;
  const avgYoY     = props.filter(p=>p.yoy!=null).reduce((s,p)=>s+p.yoy,0)/(props.filter(p=>p.yoy!=null).length||1);
  const rentM2Port = totalGPI/totalArea;
  const noiM2Port  = totalNOI/totalArea;
  const valueM2Port= totalValue/totalArea;

  const agg = {
    count:props.length, rented:rented.length, vacant:props.filter(p=>p.status==="Vacant").length,
    totalValue, totalGPI, totalEGI, totalOPEX, totalNOI, totalTaxes, totalNetCF,
    totalArea, totalDebt, vacLoss, portCapRate, occupancy, noiMargin, avgYoY,
    rentM2Port, noiM2Port, valueM2Port, equity:totalValue-totalDebt,
  };

  const owners = [...new Set(props.map(p => p.owner).filter(Boolean))].sort();
  const currencyLabel = displayCurrency || "USD";

  const { text, loading, err, generate } = useAISection(props, agg, currencyLabel, onPaywall);

  const [detailTableCopied, setDetailTableCopied] = useState(false);

  async function copyPropertyDetailTable() {
    const headers = ["Property","Status","m²","GPI","EGI","OPEX","NOI","Net CF","Cap Rate","$/m²","NOI/m²"];
    const tsvLine = (cells) =>
      cells.map((c) => String(c).replace(/[\r\n\t]/g, " ")).join("\t");
    const lines = [tsvLine(headers)];
    for (const p of props) {
      lines.push(tsvLine([
        p.name,
        p.status ?? "",
        n2(p.area, 0),
        $(p.gpi),
        $(p.egi),
        p.opex > 0 ? `(${$(p.opex)})` : "—",
        $(p.noi),
        $(p.netCF),
        pct(p.capRate),
        `$${n2(p.valueM2, 0)}`,
        `$${n2(p.noiM2, 1)}`,
      ]));
    }
    lines.push(tsvLine([
      "Total / Avg",
      "",
      n2(totalArea, 0),
      $(totalGPI),
      $(totalEGI),
      `(${$(totalOPEX)})`,
      $(totalNOI),
      $(totalNetCF),
      pct(portCapRate),
      `$${n2(valueM2Port, 0)}`,
      `$${n2(noiM2Port, 1)}`,
    ]));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setDetailTableCopied(true);
      window.setTimeout(() => setDetailTableCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }

  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});

  const expiring   = props.filter(p=>p.monthsLeft!=null&&p.monthsLeft<=3&&p.status==="Rented");
  const pendingTax = props.filter(p=>(p.taxStatus||"").toLowerCase()==="pending");
  const negNOI     = props.filter(p=>p.noi<0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Averia+Serif+Libre:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Fraunces:wght@700&family=Inter:wght@400;500;600;700&display=swap');
        @media (max-width: 600px) {
          .rpt-header { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }
          .rpt-header-meta { text-align: left !important; }
          .rpt-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
          .rpt-2col { grid-template-columns: 1fr !important; }
          .prop-table-scroll { overflow-x: auto !important; }
        }
        @media print {
          body > *:not(#pt-report) { display: none !important; }
          #pt-report { display: block !important; position: static !important; width: 100% !important; margin: 0 auto !important; max-width: 760px !important; }
          .no-print { display: none !important; }
          .print-only-placeholder { display: block !important; }
          .page-break { page-break-before: always; break-before: page; margin-top: 0; }
          .prop-table-scroll { overflow: visible !important; max-width: none !important; }
          #pt-report * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,justifyContent:"flex-end",position:"sticky",top:0,zIndex:20,background:"#fff",padding:"10px 0",margin:"0 -24px",borderBottom:"1px solid #e8ecf2",paddingLeft:32,paddingRight:32}}>
        {onBack && (
          <button onClick={onBack} style={{background:"none",border:"1px solid #e8ecf2",borderRadius:8,padding:"6px 20px",fontSize:12,fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:"#6b7280",marginRight:"auto"}}>
            ← Back
          </button>
        )}
        <button onClick={()=>{
          const el = document.getElementById('pt-report');
          const parent = el.parentNode;
          const anchor = document.createComment('print-anchor');
          parent.insertBefore(anchor, el.nextSibling);
          document.body.appendChild(el);
          window.print();
          anchor.parentNode.insertBefore(el, anchor);
          anchor.remove();
        }} style={{background:"none",color:"var(--accent-bg,#3b82f6)",border:"1.5px solid var(--accent-bg,#3b82f6)",borderRadius:8,padding:"6px 16px",fontSize:12,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          Print / Save PDF
        </button>
        <button
          onClick={generate}
          disabled={loading}
          style={{background:loading?"#93c5fd":"var(--accent-bg,#3b82f6)",border:"none",borderRadius:8,padding:"6px 24px",fontSize:12,color:"#fff",cursor:loading?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit"}}
        >
          {loading ? "Generating…" : text ? "Regenerate" : "Generate Analysis"}
        </button>
      </div>

      {/* ── REPORT ── */}
      <div id="pt-report" ref={printRef} style={{fontFamily:"Inter,system-ui,sans-serif",color:"#1a1d23",background:"#fff",maxWidth:760,margin:"0 auto"}}>

        {/* PAGE 1 header */}
        <div className="rpt-header" style={{borderBottom:"3px solid #1a1d23",paddingBottom:14,marginBottom:20,marginTop:15,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{fontFamily:"'Averia Serif Libre',Georgia,serif",fontSize:24,fontWeight:700,color:"#1a1d23",lineHeight:1}}>
              <span style={{fontStyle:"italic"}}>Simplified</span> Property Tracker
            </div>
            <div style={{fontSize:16,fontWeight:700,color:"#1a1d23",marginTop:4}}>Portfolio Performance Report{year?` · ${year}`:""}</div>
            <div style={{fontSize:10.5,color:"#9ca3af",marginTop:3}}>Currency: {currencyLabel}</div>
          </div>
          <div className="rpt-header-meta" style={{textAlign:"right",fontSize:10.5,color:"#9ca3af",display:"flex",flexDirection:"column",gap:2}}>
            <div>{today}</div>
            <div>{agg.count} {agg.count === 1 ? "property" : "properties"} · {agg.rented} rented · {agg.vacant} vacant</div>
            {owners.length > 0 && (
              <div>Owner{owners.length > 1 ? "s" : ""}: {owners.join(" · ")}</div>
            )}
          </div>
        </div>

        {/* KPI strip — 4 cols × 2 rows */}
        <div className="rpt-kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:20}}>
          {[
            {label:"Portfolio Value",  val:$(totalValue),       sub:`${$(agg.equity)} equity`},
            {label:"Annual NOI",       val:$(totalNOI),         sub:`Cap rate ${pct(portCapRate)}`},
            {label:"Net Cash Flow",    val:$(totalNetCF),       sub:`NOI margin ${pct(noiMargin)}`, c:clr(totalNetCF)},
            {label:"Occupancy",        val:pct(occupancy,0),   sub:`${agg.rented}/${agg.count} leased`},
            {label:"Avg Value YoY",    val:pct(avgYoY),         sub:"Appreciation", c:clr(avgYoY)},
            {label:"Rent / m²",        val:`$${n2(rentM2Port)}/m²`, sub:"Pricing power"},
            {label:"NOI / m²",         val:`$${n2(noiM2Port)}/m²`,  sub:"Performance density", c:clr(noiM2Port)},
            {label:"Value / m²",       val:`$${n2(valueM2Port,0)}/m²`, sub:"Market rate"},
          ].map(k=>(
            <div key={k.label} style={{background:"#f7f9fc",borderRadius:10,padding:"10px 12px",border:"1px solid #e8ecf2"}}>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:15,fontWeight:700,color:k.c||"#1a1d23"}}>{k.val}</div>
              <div style={{fontSize:9.5,color:"#6b7280",marginTop:2}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Waterfall + NOI chart */}
        <div className="rpt-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
          <div style={{background:"#f7f9fc",borderRadius:12,padding:15,border:"1px solid #e8ecf2"}}>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:11}}>Income Waterfall</div>
            <Waterfall gpi={totalGPI} vacLoss={vacLoss} opex={totalOPEX} taxes={totalTaxes} netCF={totalNetCF}/>
          </div>
          <div style={{background:"#f7f9fc",borderRadius:12,padding:15,border:"1px solid #e8ecf2",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:"auto"}}>NOI by Property</div>
            <ColChart height={92} items={props.map((p,i)=>({name:p.name,value:p.noi,color:COLORS[i%COLORS.length]}))}/>
          </div>
        </div>

        {/* Detail table — scroll wrapper so wide tables aren’t clipped in narrow modals */}
        <div style={{marginBottom:20,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8,minWidth:0}}>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af"}}>Property Detail</div>
            <button
              type="button"
              className="no-print"
              onClick={copyPropertyDetailTable}
              aria-label="Copy property detail table to clipboard"
              style={{
                background:"none",
                border:"1px solid #e8ecf2",
                borderRadius:8,
                padding:"4px 10px",
                fontSize:11,
                fontWeight:600,
                fontFamily:"inherit",
                cursor:"pointer",
                color: detailTableCopied ? "#0d9488" : "#6b7280",
                flexShrink:0,
              }}
            >
              {detailTableCopied ? "Copied" : "Copy table"}
            </button>
          </div>
          <div className="prop-table-scroll" style={{maxWidth:"100%",overflowX:"auto"}}>
          <table style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse",fontSize:10.5}}>
            <thead>
              <tr style={{background:"#f7f9fc"}}>
                {["Property","Status","m²","GPI","EGI","OPEX","NOI","Net CF","Cap Rate","$/m²","NOI/m²"].map(h=>(
                  <th key={h} style={{padding:"6px 7px",textAlign:["Property","Status"].includes(h)?"left":"right",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",color:"#9ca3af",borderBottom:"2px solid #e8ecf2"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.map((p,i)=>(
                <tr key={p.name} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"7px 7px",fontWeight:600,whiteSpace:"nowrap"}}>
                    <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:COLORS[i%COLORS.length],marginRight:6,verticalAlign:"middle"}}/>
                    {p.name}
                  </td>
                  <td style={{padding:"7px 7px"}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:p.status==="Rented"?"rgba(16,185,129,0.10)":"rgba(245,158,11,0.10)",color:p.status==="Rented"?"#065f46":"#92400e"}}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{padding:"7px 7px",textAlign:"right"}}>{n2(p.area,0)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right"}}>{$(p.gpi)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right"}}>{$(p.egi)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right",color:"#b91c1c"}}>{p.opex>0?`(${$(p.opex)})`:"—"}</td>
                  <td style={{padding:"7px 7px",textAlign:"right",fontWeight:700,color:clr(p.noi)}}>{$(p.noi)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right",fontWeight:700,color:clr(p.netCF)}}>{$(p.netCF)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right",fontWeight:600,color:clr(p.capRate)}}>{pct(p.capRate)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right"}}>${n2(p.valueM2,0)}</td>
                  <td style={{padding:"7px 7px",textAlign:"right",color:clr(p.noiM2)}}>${n2(p.noiM2,1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:"#f7f9fc",fontWeight:700,borderTop:"2px solid #e8ecf2"}}>
                <td style={{padding:"7px 7px"}}>Total / Avg</td><td/>
                <td style={{padding:"7px 7px",textAlign:"right"}}>{n2(totalArea,0)}</td>
                <td style={{padding:"7px 7px",textAlign:"right"}}>{$(totalGPI)}</td>
                <td style={{padding:"7px 7px",textAlign:"right"}}>{$(totalEGI)}</td>
                <td style={{padding:"7px 7px",textAlign:"right",color:"#b91c1c"}}>({$(totalOPEX)})</td>
                <td style={{padding:"7px 7px",textAlign:"right",color:clr(totalNOI)}}>{$(totalNOI)}</td>
                <td style={{padding:"7px 7px",textAlign:"right",color:clr(totalNetCF)}}>{$(totalNetCF)}</td>
                <td style={{padding:"7px 7px",textAlign:"right"}}>{pct(portCapRate)}</td>
                <td style={{padding:"7px 7px",textAlign:"right"}}>${n2(valueM2Port,0)}</td>
                <td style={{padding:"7px 7px",textAlign:"right",color:clr(noiM2Port)}}>${n2(noiM2Port,1)}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        {/* Rent/m² bars + Cap rate ranking */}
        <div className="rpt-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
          <div style={{background:"#f7f9fc",borderRadius:12,padding:15,border:"1px solid #e8ecf2"}}>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:10}}>Rent / m² Ranking</div>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) max-content",columnGap:10,rowGap:3,alignItems:"baseline"}}>
              {[...props].sort((a,b)=>b.rentM2-a.rentM2).flatMap(p=>(
                [
                  <span key={`${p.name}-lbl`} style={{fontSize:10.5,color:"#374151",minWidth:0}}>{p.name}</span>,
                  <span key={`${p.name}-val`} style={{fontSize:10.5,fontWeight:700,whiteSpace:"nowrap",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
                    ${n2(p.rentM2)}/m²/yr – ${n2(p.rentM2 / 12)}/m²/mth
                  </span>,
                  <div key={`${p.name}-bar`} style={{gridColumn:"1 / -1",marginBottom:8}}>
                    <HBar value={p.rentM2} max={Math.max(...props.map(x=>x.rentM2))} color={COLORS[props.indexOf(p)%COLORS.length]}/>
                  </div>,
                ]
              ))}
            </div>
          </div>
          <div style={{background:"#f7f9fc",borderRadius:12,padding:15,border:"1px solid #e8ecf2"}}>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"#9ca3af",marginBottom:10}}>Cap Rate Ranking</div>
            {(() => {
              const capRows = [...props].filter(p=>p.capRate!=null).sort((a,b)=>b.capRate-a.capRate);
              const lastIdx = capRows.length - 1;
              const rowPad = { paddingTop: 5, paddingBottom: 5 };
              const rowBorder = (rank) => (rank < lastIdx ? { borderBottom: "1px solid #e8ecf2" } : {});
              return (
                <div style={{display:"grid",gridTemplateColumns:"max-content minmax(0,1fr) max-content max-content",columnGap:10,alignItems:"center"}}>
                  {capRows.flatMap((p,rank) => ([
                    <span key={`${p.name}-rk`} style={{fontSize:10,fontWeight:700,color:rank===0?"#b45309":"#9ca3af",fontVariantNumeric:"tabular-nums",...rowPad,...rowBorder(rank)}}>#{rank+1}</span>,
                    <span key={`${p.name}-nm`} style={{fontSize:11,color:"#374151",minWidth:0,...rowPad,...rowBorder(rank)}}>{p.name}</span>,
                    <span key={`${p.name}-pct`} style={{fontSize:12,fontWeight:700,color:clr(p.capRate),textAlign:"right",whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums",...rowPad,...rowBorder(rank)}}>{pct(p.capRate)}</span>,
                    <span key={`${p.name}-yl`} style={{fontSize:10,fontWeight:600,color:"#6b7280",textAlign:"right",whiteSpace:"nowrap",...rowPad,...rowBorder(rank)}}>{capRateYieldLabel(p.capRate)}</span>,
                  ]))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Alerts */}
        {(expiring.length>0||pendingTax.length>0||negNOI.length>0)&&(
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            {expiring.length>0&&(
              <div style={{flex:1,minWidth:180,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:9.5,fontWeight:700,color:"#92400e",marginBottom:5}}>⏰ CONTRACTS EXPIRING ≤ 3 MONTHS</div>
                {expiring.map(p=><div key={p.name} style={{fontSize:11,color:"#374151"}}>{p.name} — <strong>{p.monthsLeft} mo left</strong></div>)}
              </div>
            )}
            {pendingTax.length>0&&(
              <div style={{flex:1,minWidth:180,background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:9.5,fontWeight:700,color:"#9f1239",marginBottom:6}}>🧾 PENDING TAX STATUS</div>
                {pendingTax.map(p=>{
                  const total = p.pendingTaxItems.reduce((s,t)=>s+t.amount,0);
                  return (
                    <div key={p.name} style={{marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:3}}>{p.name}</div>
                      {p.pendingTaxItems.map((t,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#6b7280",paddingLeft:8}}>
                          <span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}</span>
                          <span style={{fontWeight:600,color:"#9f1239"}}>{$(t.amount)}</span>
                        </div>
                      ))}
                      {p.pendingTaxItems.length>1&&(
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,fontWeight:700,color:"#9f1239",paddingLeft:8,marginTop:3,borderTop:"1px solid #fecdd3",paddingTop:3}}>
                          <span>Total</span>
                          <span>{$(total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {negNOI.length>0&&(
              <div style={{flex:1,minWidth:180,background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:9.5,fontWeight:700,color:"#9f1239",marginBottom:5}}>📉 NEGATIVE NOI</div>
                {negNOI.map(p=><div key={p.name} style={{fontSize:11,color:"#374151"}}>{p.name} — <strong>{$(p.noi)}</strong></div>)}
              </div>
            )}
          </div>
        )}

        {/* PAGE 2 — Analyst Commentary */}
        <div className="page-break"/>
        <div style={{borderBottom:"1px solid #e8ecf2",paddingBottom:12,marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <div style={{fontFamily:"'Averia Serif Libre',Georgia,serif",fontSize:18,fontWeight:700,color:"#1a1d23"}}>Analyst Commentary</div>
          <div style={{fontSize:10,color:"#9ca3af"}}>AI-generated · {today}</div>
        </div>

        <AISection text={text} loading={loading} err={err} generate={generate}/>

        {/* Footer */}
        <div style={{marginTop:32,paddingTop:12,borderTop:"1px solid #e8ecf2",display:"flex",justifyContent:"space-between",fontSize:9.5,color:"#9ca3af"}}>
          <span>Simplified Property Tracker · Portfolio Report · {today}</span>
          <span>All figures {currencyLabel} · For personal use only</span>
        </div>

      </div>
    </>
  );
}
