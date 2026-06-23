const colorMap = {
  accent: { ring: "ring-accent/15", val: "text-accent"   },
  green:  { ring: "ring-success/15", val: "text-success"  },
  amber:  { ring: "ring-warn/15",    val: "text-warn"     },
  red:    { ring: "ring-danger/15",  val: "text-danger"   },
};

export default function MetricCard({ label, value, sub, color = "accent" }) {
  const cfg = colorMap[color] || colorMap.accent;
  return (
    <div className={`bg-white rounded-2xl shadow-card border border-border p-5 ring-1 ${cfg.ring} transition-all duration-200 hover:shadow-card-md hover:-translate-y-0.5`}>
      <div className="text-[10px] font-bold text-muted uppercase tracking-[0.08em] mb-2.5">{label}</div>
      <div className={`text-2xl font-bold leading-tight ${cfg.val}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1.5">{sub}</div>}
    </div>
  );
}
