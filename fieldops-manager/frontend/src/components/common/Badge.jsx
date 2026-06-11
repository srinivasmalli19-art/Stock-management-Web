import { statusBadgeClass } from "../../constants/statusColors";

export default function Badge({ status, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(status)} ${className}`}
    >
      {children || status?.replace(/_/g, " ")}
    </span>
  );
}
