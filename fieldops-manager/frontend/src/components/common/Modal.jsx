import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, width = "460px" }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-lg p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ width, maxWidth: "95vw" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
