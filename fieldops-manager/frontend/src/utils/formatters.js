export const formatDate = (d) => {
  if (!d) return "—";
  // Parse ISO date strings (YYYY-MM-DD) as local time to avoid UTC timezone shift
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatCurrency = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

export const formatMonth = (prefix) => {
  const [y, m] = prefix.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export const genId = (prefix = "ID") => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${date}-${rand}`;
};

export const genPassword = (len = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const getCurrentMonthPrefix = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const getMonthRange = (prefix) => {
  const [y, m] = prefix.split("-");
  const start = new Date(parseInt(y), parseInt(m) - 1, 1);
  const end = new Date(parseInt(y), parseInt(m), 0);
  return { start, end, daysInMonth: end.getDate() };
};

export const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Client-side CSV builder — UTF-8 BOM ensures correct Excel rendering
export const buildCsvBlob = (headers, rows) => {
  const escape = (v) => {
    const s = String(v == null ? "" : v);
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
};

export const todayStr = () => new Date().toISOString().split("T")[0];
