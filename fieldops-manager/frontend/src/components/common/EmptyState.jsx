export default function EmptyState({ icon = "ti-clipboard-off", message = "No data available", sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-accent2/60 flex items-center justify-center mb-5 shadow-card">
        <i className={`ti ${icon} text-[2.5rem] text-accent/40`} />
      </div>
      <p className="text-[15px] font-semibold text-text mb-1.5 tracking-tight">{message}</p>
      {sub && <p className="text-sm text-muted max-w-[300px] leading-relaxed font-medium">{sub}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
