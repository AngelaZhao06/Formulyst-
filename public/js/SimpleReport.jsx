const { useState, useEffect } = React;

function Pill({ label }) {
  const colors = {
    High: "bg-red-100 text-red-700",
    Medium: "bg-orange-100 text-orange-700",
    Low: "bg-green-100 text-green-700",
    Variable: "bg-yellow-100 text-yellow-700",
  };
  if (label === "Unknown") return null;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[label] || "bg-slate-100 text-slate-700"}`}>
      {label}
    </span>
  );
}

function SourceList({ item }) {
  const sources = [
    item.source_regulatory,
    item.source_scientific,
    item.source_consumer,
  ].filter(Boolean);
  if (!sources.length) return null;
  return (
    <ul className="list-disc pl-5 text-xs text-gray-600 mt-2">
      {sources.map((s, i) => <li key={i}>{s}</li>)}
    </ul>
  );
}

function HealthSection({ items }) {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-rose-600 mb-3">Health Hazards</h2>
      <div className="space-y-3">
        {items.filter(it => it.hazard_level !== "Unknown").map((it) => (
          <div key={it.id} className="p-4 rounded-lg border bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{it.name}</h3>
              <Pill label={it.hazard_level} />
            </div>
            {it.reasons?.length ? (
              <ul className="list-disc ml-5 mt-2 text-sm text-gray-700">
                {it.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            ) : null}
            <SourceList item={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvSection({ items }) {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-emerald-600 mb-3">Environmental Impacts</h2>
      <div className="space-y-3">
        {items.map((it) => {
          const ei = it.environmental_impact || {};
          return (
            <div key={it.id} className="p-4 rounded-lg border bg-white">
              <h3 className="font-semibold">{it.name}</h3>
              <div className="grid sm:grid-cols-3 gap-2 mt-2 text-sm">
                {ei.aquatic_toxicity !== "Unknown" && <div>Aquatic toxicity: {ei.aquatic_toxicity}</div>}
                {ei.bioaccumulation !== "Unknown" && <div>Bioaccumulation: {ei.bioaccumulation}</div>}
                {ei.persistence !== "Unknown" && <div>Persistence: {ei.persistence}</div>}
              </div>
              <SourceList item={it} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimpleReport({ initialData }) {
  const items = initialData?.analysis || [];
  const health = items.filter((it) => it.hazard_level && it.hazard_level !== "Unknown");
  const env = items.filter((it) => it.environmental_impact);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900">Formulyst Report</h1>
      <p className="text-sm text-gray-600 mb-6">Simplified view of hazards and impacts.</p>
      <HealthSection items={health} />
      <EnvSection items={env} />
    </div>
  );
}

// Mount it
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<SimpleReport initialData={window.__FORMULYST__} />);
