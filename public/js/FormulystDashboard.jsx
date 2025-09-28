import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

/**
 * Formulyst Risk & Environment Dashboard
 * - Paste JSON from your analyzer into the left panel and click "Load JSON"
 * - Shows Health and Environment sections with itemized details and sources
 * - Computes 0–100 risk scores (higher = worse) for Health & Environment
 *
 * Styling: TailwindCSS (no external UI deps needed).
 */

const sampleReport = {
  analysis: [
    {
      cas: ["99-76-3", "120-47-8", "94-13-3", "94-26-8"],
      categories: ["endocrine_disruptor", "preservative"],
      confidence: 0.99,
      environmental_impact: {
        aquatic_toxicity: "Moderate (toxic to algae/fish at higher concentrations)",
        bioaccumulation: "Low",
        persistence: "Moderate (partially biodegradable)",
      },
      hazard_level: "High",
      id: "ing_parabens_methyl_ethyl_propyl_butyl_29bf0ed0",
      matched_alias: "methylparaben",
      name: "Parabens (Methyl-, Ethyl-, Propyl-, Butyl-)",
      prop65: false,
      query: "methylparaben",
      reasons: ["Endocrine activity; restrictions in certain regions"],
      recommendation: "Restricted",
      regulatory_CA: "restricted",
      regulatory_EU: "restricted",
      source_consumer: "EWG Skin Deep",
      source_regulatory: "Health Canada Hotlist (restrictions); EU SCCS opinions",
      source_scientific: "SCCS opinions on parabens",
    },
    {
      cas: ["122-99-6"],
      categories: ["preservative", "irritant"],
      confidence: 0.99,
      environmental_impact: {
        aquatic_toxicity: "Moderate (toxic to fish/invertebrates)",
        bioaccumulation: "Low",
        persistence: "Moderate (partially biodegradable)",
      },
      hazard_level: "Medium",
      id: "ing_phenoxyethanol_b5b1eb43",
      matched_alias: "phenoxyethanol",
      name: "Phenoxyethanol",
      prop65: false,
      query: "phenoxyethanol",
      reasons: ["Restricted typically to ≤1% in many jurisdictions"],
      recommendation: "Restricted",
      regulatory_CA: "restricted (≤1% typical)",
      regulatory_EU: "restricted (Annex V)",
      source_consumer: "EWG Skin Deep",
      source_regulatory: "EU Annex V; Health Canada positions",
      source_scientific: "SCCS Opinion 2016",
    },
    {
      cas: ["128-37-0"],
      categories: ["antioxidant", "endocrine_activity"],
      confidence: 1,
      environmental_impact: {
        aquatic_toxicity: "Unknown",
        bioaccumulation: "Unknown",
        persistence: "Unknown",
      },
      hazard_level: "Medium",
      id: "ing_bht_butylated_hydroxytoluene_75a560e1",
      matched_alias: "bht (butylated hydroxytoluene)",
      name: "BHT (Butylated Hydroxytoluene)",
      prop65: false,
      query: "bht",
      reasons: ["Endocrine activity data; allowed with limits"],
      recommendation: "Safe but criticized",
      regulatory_CA: "allowed",
      regulatory_EU: "allowed/restricted",
      source_consumer: "EWG Skin Deep",
      source_regulatory: "EU opinions; general allowances",
      source_scientific: "CIR Review",
    },
    {
      cas: [],
      categories: ["allergen", "sensitizer", "mixture"],
      confidence: 0.99,
      environmental_impact: {
        aquatic_toxicity: "High (many fragrance compounds toxic to aquatic life)",
        bioaccumulation: "Moderate",
        persistence: "Variable (depends on components)",
      },
      hazard_level: "Medium",
      id: "ing_fragrance_parfum_allergens_30782c47",
      matched_alias: "parfum",
      name: "Fragrance / Parfum (allergens)",
      prop65: false,
      query: "parfum",
      reasons: ["Undisclosed mixture; EU allergen labeling list"],
      recommendation: "Restricted",
      regulatory_CA: "allowed (labeling)",
      regulatory_EU: "restricted (Annex III allergens)",
      source_consumer: "EWG Skin Deep",
      source_regulatory: "EU Annex III Fragrance allergens; IFRA",
      source_scientific: "SCCS fragrance allergen opinions",
    },
  ],
  summary: {
    environment: {
      aquatic_toxicity: { High: 2, Low: 0, Moderate: 1, Unknown: 1, Variable: 0 },
      bioaccumulation: { High: 0, Low: 2, Moderate: 1, Unknown: 1, Variable: 0 },
      ingredients_with_any_high_env_flag: 2,
      persistence: { High: 0, Low: 0, Moderate: 2, Unknown: 1, Variable: 1 },
    },
    health: { high: 1, low: 0, medium: 3, total: 4 },
  },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Parse a field like "Moderate (toxic to fish)" → {label: "Moderate", note: "toxic to fish"}
function parseLevelNote(s) {
  if (!s) return { label: "Unknown", note: "" };
  const m = String(s).match(/^(High|Moderate|Low|Unknown|Variable)\s*(?:\((.*)\))?/i);
  if (!m) return { label: s, note: "" };
  return { label: capitalize(m[1]), note: m[2] || "" };
}

function capitalize(s) {
  return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
}

const HEALTH_WEIGHT = { High: 1.0, Medium: 0.6, Low: 0.3 };
const ENV_WEIGHT = { High: 1.0, Moderate: 0.6, Low: 0.2, Unknown: 0.5, Variable: 0.6 };

function computeHealthRiskScore(items) {
  if (!items?.length) return 0;
  const scores = items.map((it) => {
    const base = HEALTH_WEIGHT[it.hazard_level] ?? 0.3;
    const catBump = (it.categories || []).some((c) => /endocrine/i.test(c)) ? 0.15 : 0;
    const prop65Bump = it.prop65 ? 0.2 : 0;
    return clamp01(base + catBump + prop65Bump);
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 100);
}

function computeEnvRiskScore(items) {
  if (!items?.length) return 0;
  const perItem = items.map((it) => {
    const ei = it.environmental_impact || {};
    const a = ENV_WEIGHT[parseLevelNote(ei.aquatic_toxicity).label] ?? 0.5;
    const b = ENV_WEIGHT[parseLevelNote(ei.bioaccumulation).label] ?? 0.5;
    const c = ENV_WEIGHT[parseLevelNote(ei.persistence).label] ?? 0.5;
    return (a + b + c) / 3;
  });
  const avg = perItem.reduce((a, b) => a + b, 0) / perItem.length;
  return Math.round(avg * 100);
}

function RiskBar({ value }) {
  return (
    <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${
          value < 34 ? "bg-green-500" : value < 67 ? "bg-yellow-500" : "bg-red-500"
        }`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl shadow-sm bg-white/80 backdrop-blur border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="p-5 border-b border-gray-100 flex items-start justify-between">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function CardBody({ children, className = "" }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 text-xl font-semibold">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function SourceChips({ item }) {
  const chips = [
    item.source_regulatory && { text: item.source_regulatory, tone: "blue" },
    item.source_scientific && { text: item.source_scientific, tone: "violet" },
    item.source_consumer && { text: item.source_consumer, tone: "green" },
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((c, i) => (
        <Badge key={i} tone={c.tone}>{c.text}</Badge>
      ))}
    </div>
  );
}

function Pill({ label }) {
  const map = { High: "red", Medium: "orange", Low: "green", Unknown: "slate", Variable: "orange" };
  const tone = map[label] || "slate";
  return <Badge tone={tone}>{label}</Badge>;
}

function PrettyList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((x, i) => (
          <Badge key={i}>{x}</Badge>
        ))}
      </div>
    </div>
  );
}

function HealthItem({ item }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900">{item.name}</h4>
            <Pill label={item.hazard_level || "Unknown"} />
            {item.recommendation && <Badge tone="slate">{item.recommendation}</Badge>}
          </div>
          {item.matched_alias && (
            <p className="text-sm text-gray-500 mt-1">Matched: <span className="font-mono">{item.matched_alias}</span></p>
          )}
          {item.reasons?.length ? (
            <ul className="list-disc ml-5 mt-3 text-sm text-gray-700">
              {item.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <PrettyList title="Categories" items={item.categories} />
            <PrettyList title="CAS" items={item.cas?.length ? item.cas : ["—"]} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            {item.regulatory_CA && <Badge tone="blue">Canada: {item.regulatory_CA}</Badge>}
            {item.regulatory_EU && <Badge tone="blue">EU: {item.regulatory_EU}</Badge>}
            <Badge tone={item.prop65 ? "red" : "green"}>Prop65: {item.prop65 ? "Listed" : "No"}</Badge>
            <Badge tone="slate">Confidence: {Math.round((item.confidence ?? 0) * 100)}%</Badge>
          </div>
          <SourceChips item={item} />
        </div>
      </div>
    </motion.div>
  );
}

function EnvItem({ item }) {
  const ei = item.environmental_impact || {};
  const at = parseLevelNote(ei.aquatic_toxicity);
  const ba = parseLevelNote(ei.bioaccumulation);
  const pe = parseLevelNote(ei.persistence);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-gray-900">{item.name}</h4>
          {item.recommendation && <Badge tone="slate">{item.recommendation}</Badge>}
        </div>
        <div className="text-xs text-gray-600">ID: <span className="font-mono">{item.id}</span></div>
      </div>

      <div className="mt-3 grid md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs font-medium text-gray-500">Aquatic toxicity</p>
          <div className="mt-1 flex items-center gap-2"><Pill label={at.label} />{at.note && <span className="text-sm text-gray-700">{at.note}</span>}</div>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs font-medium text-gray-500">Bioaccumulation</p>
          <div className="mt-1 flex items-center gap-2"><Pill label={ba.label} />{ba.note && <span className="text-sm text-gray-700">{ba.note}</span>}</div>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-xs font-medium text-gray-500">Persistence</p>
          <div className="mt-1 flex items-center gap-2"><Pill label={pe.label} />{pe.note && <span className="text-sm text-gray-700">{pe.note}</span>}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
        {item.regulatory_CA && <Badge tone="blue">Canada: {item.regulatory_CA}</Badge>}
        {item.regulatory_EU && <Badge tone="blue">EU: {item.regulatory_EU}</Badge>}
        <Badge tone="slate">Confidence: {Math.round((item.confidence ?? 0) * 100)}%</Badge>
      </div>
      <SourceChips item={item} />
    </motion.div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Formulyst Report</h1>
        <p className="text-sm text-gray-600 mt-1">Health and Environmental assessment based on detected ingredients.</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Scores: 0 (best) → 100 (worst)</p>
      </div>
    </div>
  );
}

export default function FormulystDashboard({ initialData = sampleReport }) {
  const [raw, setRaw] = useState(JSON.stringify(initialData, null, 2));
  const [report, setReport] = useState(initialData);
  const [onlyHazardous, setOnlyHazardous] = useState(true);
  const [query, setQuery] = useState("");

  const items = useMemo(() => report?.analysis || [], [report]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const level = it.hazard_level || "";
      const includeHaz = !onlyHazardous || /high|medium/i.test(level);
      const includeSearch = !q || [it.name, it.matched_alias, ...(it.categories || [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
      return includeHaz && includeSearch;
    });
  }, [items, onlyHazardous, query]);

  const healthScore = useMemo(() => computeHealthRiskScore(items), [items]);
  const envScore = useMemo(() => computeEnvRiskScore(items), [items]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Header />

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          {/* Left: JSON input */}
          <Card className="lg:col-span-1">
            <CardHeader title="Input JSON" subtitle="Paste the analyzer output here" right={null} />
            <CardBody>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="w-full h-64 font-mono text-sm p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                spellCheck={false}
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(raw);
                      setReport(parsed);
                    } catch (e) {
                      alert("Invalid JSON: " + e.message);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Load JSON
                </button>
                <button
                  onClick={() => setRaw(JSON.stringify(sampleReport, null, 2))}
                  className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
                >
                  Reset sample
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Right: Scores & Filters */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Health Risk" subtitle="Aggregated from hazard levels, endocrine flags, and Prop65" right={<Badge tone="slate">0–100</Badge>} />
              <CardBody>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold">{healthScore}</div>
                  <div className="w-2/3"><RiskBar value={healthScore} /></div>
                </div>
                <p className="text-xs text-gray-600">Weights: High=1.0, Medium=0.6, Low=0.3; +0.15 if endocrine-related; +0.2 if Prop65. Averaged then ×100.</p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Environment Risk" subtitle="Aquatic toxicity, bioaccumulation, persistence" right={<Badge tone="slate">0–100</Badge>} />
              <CardBody>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold">{envScore}</div>
                  <div className="w-2/3"><RiskBar value={envScore} /></div>
                </div>
                <p className="text-xs text-gray-600">Weights: High=1.0, Moderate=0.6, Low=0.2, Unknown=0.5, Variable=0.6; averaged per item and overall, ×100.</p>
              </CardBody>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader
                title="Filters"
                subtitle="Narrow the list below"
                right={
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" className="accent-emerald-600" checked={onlyHazardous} onChange={(e) => setOnlyHazardous(e.target.checked)} />
                      Only High/Medium
                    </label>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name / alias / category"
                      className="px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                }
              />
              <CardBody>
                <p className="text-sm text-gray-600">Showing <span className="font-medium">{filtered.length}</span> of {items.length} ingredients.</p>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Health Section */}
        <div className="mt-8">
          <SectionTitle icon={<span className="text-rose-500">❤</span>}>Health</SectionTitle>
          <p className="text-sm text-gray-600 mt-1">Materials that are hazardous, why they are hazardous, and their hazard levels with sources.</p>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {filtered.map((item) => (
              <HealthItem key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Environment Section */}
        <div className="mt-10">
          <SectionTitle icon={<span className="text-emerald-600">♻</span>}>Environment</SectionTitle>
          <p className="text-sm text-gray-600 mt-1">Aquatic toxicity, bioaccumulation, and persistence for each material, with sources.</p>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {filtered.map((item) => (
              <EnvItem key={item.id + "-env"} item={item} />
            ))}
          </div>
        </div>

        <footer className="mt-12 text-center text-xs text-gray-500">
          Built with ❤ for Formulyst — paste your own JSON and ship.
        </footer>
      </div>
    </div>
  );
}
