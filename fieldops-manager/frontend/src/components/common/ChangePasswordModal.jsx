import { useState } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";
import Modal from "./Modal";

const FIELDS = [
  { key: "oldPassword", label: "Current Password", showKey: "old" },
  { key: "newPassword", label: "New Password (min. 8 characters)", showKey: "new" },
  { key: "confirmPassword", label: "Confirm New Password", showKey: "confirm" },
];

const EMPTY_FORM = { oldPassword: "", newPassword: "", confirmPassword: "" };
const EMPTY_SHOW = { old: false, new: false, confirm: false };

export default function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [show, setShow] = useState(EMPTY_SHOW);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const reset = () => {
    setForm(EMPTY_FORM);
    setShow(EMPTY_SHOW);
    setFormError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (form.newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFormError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.patch("/auth/change-password", {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password changed successfully");
      reset();
      onClose();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit}>
        {FIELDS.map(({ key, label, showKey }) => (
          <div key={key} className="mb-3.5">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              {label}
            </label>
            <div className="relative">
              <input
                type={show[showKey] ? "text" : "password"}
                className="input pr-10"
                value={form[key]}
                onChange={(e) => {
                  setForm((f) => ({ ...f, [key]: e.target.value }));
                  setFormError(null);
                }}
                required
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer"
                onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))}
              >
                <i className={`ti ${show[showKey] ? "ti-eye-off" : "ti-eye"}`} />
              </button>
            </div>
          </div>
        ))}

        {formError && (
          <div className="text-sm text-danger bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
            {formError}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            className="btn flex-1"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? "Saving…" : "Change Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
