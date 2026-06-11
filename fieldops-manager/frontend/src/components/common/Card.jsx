export default function Card({ children, className = "", padding = true }) {
  return (
    <div
      className={`bg-white border border-border rounded-lg shadow-card ${padding ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-text">{children}</h3>
      {right && <span className="text-xs text-muted">{right}</span>}
    </div>
  );
}
