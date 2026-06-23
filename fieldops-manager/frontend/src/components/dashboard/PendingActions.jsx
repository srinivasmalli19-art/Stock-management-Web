import { Link } from "react-router-dom";
import Card, { CardTitle } from "../common/Card";

export default function PendingActions({ items = [] }) {
  const actionItems = items.filter(Boolean);
  const hasAny = actionItems.some((i) => i.count > 0);

  return (
    <Card padding={false}>
      <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <CardTitle>Needs Attention</CardTitle>
        {hasAny && (
          <span className="text-[10px] font-bold text-white bg-danger rounded-full px-2 py-0.5">
            {actionItems.reduce((s, i) => s + (i.count || 0), 0)} pending
          </span>
        )}
      </div>
      <div className="divide-y divide-border">
        {actionItems.length === 0 || !hasAny ? (
          <div className="px-5 py-6 flex items-center gap-3 text-sm text-success">
            <i className="ti ti-circle-check text-xl" />
            <span className="font-medium">All clear — nothing needs attention</span>
          </div>
        ) : (
          actionItems.map(({ label, count, to, color = "amber" }) => {
            const colorMap = {
              amber:  "bg-amber-50 text-amber-700 border-amber-200",
              red:    "bg-red-50 text-red-700 border-red-200",
              accent: "bg-blue-50 text-blue-700 border-blue-200",
              purple: "bg-purple-50 text-purple-700 border-purple-200",
              green:  "bg-green-50 text-green-700 border-green-200",
            };
            const badge = count > 0
              ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorMap[color] || colorMap.amber}`}>{count}</span>
              : <span className="text-[10px] text-muted">✓</span>;

            const inner = (
              <div className={`flex items-center justify-between px-5 py-3.5 ${count > 0 && to ? "hover:bg-gray-50 transition-colors cursor-pointer" : ""}`}>
                <span className={`text-sm ${count > 0 ? "font-medium text-text" : "text-muted"}`}>{label}</span>
                <div className="flex items-center gap-2">
                  {badge}
                  {count > 0 && to && <i className="ti ti-chevron-right text-xs text-muted" />}
                </div>
              </div>
            );

            if (count > 0 && to) return <Link key={label} to={to} className="block">{inner}</Link>;
            return <div key={label}>{inner}</div>;
          })
        )}
      </div>
    </Card>
  );
}
