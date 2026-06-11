export default function EmptyState({ icon = "ti-clipboard-off", message = "No data available" }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted">
      <i className={`ti ${icon} text-4xl opacity-40 block mb-3`} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
