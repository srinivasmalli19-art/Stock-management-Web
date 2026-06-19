import { useEffect } from "react";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape" && !loading) onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel, loading]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 modal-overlay"
      onClick={(e) => !loading && e.target === e.currentTarget && onCancel?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-title"
    >
      <div className="bg-white rounded-lg shadow-2xl modal-panel w-full max-w-sm">
        <div className="p-6 pb-4">
          <h2 id="cd-title" className="text-base font-bold text-text mb-2">{title}</h2>
          {message && <p className="text-sm text-text leading-relaxed">{message}</p>}
          {detail && <p className="text-xs text-muted mt-1.5 leading-relaxed">{detail}</p>}
        </div>
        <div className="flex gap-2 justify-end px-6 pb-5">
          <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
