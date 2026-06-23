import { Link } from "react-router-dom";
import Card, { CardTitle } from "../common/Card";

export default function QuickActions({ actions = [] }) {
  return (
    <Card>
      <CardTitle>Quick Actions</CardTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {actions.map(({ label, icon, to }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-gray-50 hover:bg-accent2/20 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-150 text-center group"
          >
            <span className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center shadow-sm group-hover:border-accent/50 transition-colors">
              <i className={`ti ${icon} text-lg text-accent`} />
            </span>
            <span className="text-[11px] font-semibold text-text leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
