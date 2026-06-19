export default function EmptyState({ icon = "ti-clipboard-off", message = "No data available", sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <i className={`ti ${icon} text-[2.5rem] text-muted opacity-25 block mb-3`} />
      <p className="text-sm font-medium text-text/70">{message}</p>
      {sub && <p className="text-xs text-muted mt-1.5 max-w-[220px] leading-relaxed">{sub}</p>}
    </div>
  );
}
