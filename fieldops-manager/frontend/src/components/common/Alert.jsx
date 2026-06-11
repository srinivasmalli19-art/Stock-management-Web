const variants = {
  warn: "bg-amber-50 border border-amber-300 text-amber-900",
  danger: "bg-red-50 border border-red-300 text-red-900",
  success: "bg-green-50 border border-green-300 text-green-900",
  info: "bg-cyan-50 border border-cyan-300 text-cyan-900",
};

const icons = {
  warn: "ti-alert-triangle",
  danger: "ti-alert-circle",
  success: "ti-circle-check",
  info: "ti-info-circle",
};

export default function Alert({ variant = "info", children }) {
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded text-sm mb-3 ${variants[variant]}`}>
      <i className={`ti ${icons[variant]} mt-0.5 flex-shrink-0`} />
      <span>{children}</span>
    </div>
  );
}
