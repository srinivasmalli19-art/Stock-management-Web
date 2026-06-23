export default function EmptyState({ icon = "ti-clipboard-off", message = "No data available", sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <i className={`ti ${icon} text-[3rem] text-muted opacity-20 block mb-4`} />
      <p className="text-base font-semibold text-text/80 mb-1">{message}</p>
      {sub && <p className="text-sm text-muted mt-1.5 max-w-[260px] leading-relaxed">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
