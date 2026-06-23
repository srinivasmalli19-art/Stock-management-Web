export default function EmptyState({ icon = "ti-clipboard-off", message = "No data available", sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-accent2/50 flex items-center justify-center mb-5">
        <i className={`ti ${icon} text-[2rem] text-accent/50`} />
      </div>
      <p className="text-base font-semibold text-text mb-1.5">{message}</p>
      {sub && <p className="text-sm text-muted max-w-[280px] leading-relaxed">{sub}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
