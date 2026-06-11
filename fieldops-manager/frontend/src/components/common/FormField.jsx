export default function FormField({ label, error, children, required }) {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3 py-2 border border-border2 rounded text-sm bg-white text-text outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10";

export const selectClass =
  "w-full px-3 py-2 border border-border2 rounded text-sm bg-white text-text outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10 cursor-pointer";
