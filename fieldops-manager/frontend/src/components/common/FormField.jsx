export default function FormField({ label, error, children, required, htmlFor }) {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={htmlFor} className="block text-[12px] font-bold text-muted uppercase tracking-wide mb-1.5">
          {label}{required && <span className="text-danger ml-0.5 font-bold">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger mt-1.5 font-medium">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3 py-2.5 border border-border2 rounded-xl text-sm font-medium bg-white text-text outline-none transition-all focus:border-accent focus:ring-4 focus:ring-indigo-50 hover:border-indigo-300";

export const selectClass =
  "w-full px-3 py-2.5 border border-border2 rounded-xl text-sm font-medium bg-white text-text outline-none transition-all focus:border-accent focus:ring-4 focus:ring-indigo-50 hover:border-indigo-300 cursor-pointer";
