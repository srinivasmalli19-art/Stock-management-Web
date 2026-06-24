export default function Card({ children, className = "", padding = true }) {
  return (
    <div
      className={`bg-white rounded-3xl shadow-card border border-border ${padding ? "p-5 sm:p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-text tracking-tight">{children}</h3>
      {right && <span className="text-xs text-muted font-medium">{right}</span>}
    </div>
  );
}
