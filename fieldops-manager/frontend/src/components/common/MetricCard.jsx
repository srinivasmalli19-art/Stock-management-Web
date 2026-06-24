const colorMap = {
  accent: { ring: "ring-indigo-100", iconBg: "bg-indigo-50", iconFg: "text-indigo-600", val: "text-accent" },
  green:  { ring: "ring-green-100",  iconBg: "bg-green-50",  iconFg: "text-green-700",  val: "text-success" },
  amber:  { ring: "ring-amber-100",  iconBg: "bg-amber-50",  iconFg: "text-amber-700",  val: "text-warn" },
  red:    { ring: "ring-red-100",    iconBg: "bg-red-50",    iconFg: "text-red-600",    val: "text-danger" },
};

export default function MetricCard({ label, value, sub, color = "accent", icon }) {
  const cfg = colorMap[color] || colorMap.accent;
  return (
    <div className={`bg-white rounded-3xl shadow-card border border-border ring-1 ${cfg.ring} p-5 transition-all duration-200 hover:shadow-card-md hover:-translate-y-1`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em] leading-tight pr-2">{label}</div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
            <i className={`ti ${icon} text-[19px] ${cfg.iconFg}`} />
          </div>
        )}
      </div>
      <div className={`text-4xl font-extrabold leading-none tracking-tight ${cfg.val}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-2.5 font-medium">{sub}</div>}
    </div>
  );
}
