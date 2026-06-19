const colors = {
  accent: "border-l-accent",
  green: "border-l-success",
  amber: "border-l-warn",
  red: "border-l-danger",
};

export default function MetricCard({ label, value, sub, color = "accent" }) {
  return (
    <div className={`bg-white border border-border rounded-lg shadow-card p-4 border-l-4 transition-all duration-200 hover:shadow-md ${colors[color] || colors.accent}`}>
      <div className="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-text leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
