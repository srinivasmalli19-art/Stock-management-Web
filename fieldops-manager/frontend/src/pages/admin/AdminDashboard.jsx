import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck, Package, RotateCcw, Receipt, BadgeDollarSign,
  AlertTriangle, CalendarCheck, TrendingUp,
} from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, formatMonth, getCurrentMonthPrefix } from "../../utils/formatters";

const StatTile = ({ icon: Icon, label, value, sub, color = "accent" }) => {
  const colors = {
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.accent}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-75">{sub}</div>}
    </div>
  );
};

export default function AdminDashboard() {
  const prefix = getCurrentMonthPrefix();

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/dashboard/admin").then((r) => r.data.data),
    staleTime: 60000,
  });

  const { data: lpData } = useQuery({
    queryKey: ["admin-lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
    staleTime: 30000,
  });

  const { data: claimData } = useQuery({
    queryKey: ["admin-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
  });

  const { data: invData } = useQuery({
    queryKey: ["inventory-main"],
    queryFn: () => api.get("/inventory/main").then((r) => r.data.data),
    staleTime: 60000,
  });

  const { data: attSummary } = useQuery({
    queryKey: ["attendance-summary", prefix],
    queryFn: () =>
      api.get("/attendance/summary", { params: { month: prefix } }).then((r) => r.data.data),
    staleTime: 60000,
  });

  if (dashLoading) return <PageSpinner />;

  const { pendingProductivity = 0, pendingPurchase = 0, pendingRevoke = 0 } = dashData || {};

  const lpList = lpData || [];
  const claimList = claimData || [];
  const inventory = invData || [];
  const summary = attSummary || [];

  const pendingLP = lpList.filter((r) => r.status === "LP_PENDING_ADMIN_APPROVAL").length;
  const pendingClaims = claimList.filter((c) => c.status === "CLAIM_ADMIN_APPROVAL_PENDING").length;
  const lowStockItems = inventory.filter((i) => i.isLowStock);
  const totalInventoryValue = inventory.reduce((s, i) => s + i.totalValue, 0);

  const totalPresent = summary.reduce((s, e) => s + (e.daysPresent || 0), 0);
  const totalAbsent = summary.reduce((s, e) => s + (e.daysAbsent || 0), 0);
  const totalDays = totalPresent + totalAbsent;
  const overallPct = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{formatMonth(prefix)} — operations overview</p>
      </div>

      {/* Pending actions */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Pending Actions</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatTile icon={ClipboardCheck} label="Productivity" value={pendingProductivity} sub="awaiting approval" color={pendingProductivity > 0 ? "amber" : "green"} />
          <StatTile icon={Package} label="Purchase Inward" value={pendingPurchase} sub="awaiting approval" color={pendingPurchase > 0 ? "amber" : "green"} />
          <StatTile icon={RotateCcw} label="Revoke Requests" value={pendingRevoke} sub="awaiting review" color={pendingRevoke > 0 ? "amber" : "green"} />
          <StatTile icon={Receipt} label="LP Requests" value={pendingLP} sub="awaiting approval" color={pendingLP > 0 ? "purple" : "green"} />
          <StatTile icon={BadgeDollarSign} label="Claims" value={pendingClaims} sub="awaiting final approval" color={pendingClaims > 0 ? "red" : "green"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Inventory alerts */}
        <Card>
          <CardTitle right={formatCurrency(totalInventoryValue) + " total value"}>
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-warn" />
              Inventory Alerts
            </span>
          </CardTitle>
          {lowStockItems.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success py-2">
              <TrendingUp size={16} />
              All items are adequately stocked
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 8).map((i) => (
                <div key={i.skuId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                  <div>
                    <span className="font-medium">{i.skuName}</span>
                    <span className="ml-2 text-xs text-muted font-mono">{i.skuId}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-danger">{i.qty}</span>
                    <span className="text-xs text-muted ml-1">/ alert {i.lowStockAlert}</span>
                  </div>
                </div>
              ))}
              {lowStockItems.length > 8 && (
                <div className="text-xs text-muted pt-1">+{lowStockItems.length - 8} more low stock items</div>
              )}
            </div>
          )}
        </Card>

        {/* Attendance summary */}
        <Card>
          <CardTitle right={`${overallPct}% overall attendance`}>
            <span className="flex items-center gap-1.5">
              <CalendarCheck size={15} className="text-accent" />
              Attendance — {formatMonth(prefix)}
            </span>
          </CardTitle>
          {summary.length === 0 ? (
            <div className="text-sm text-muted py-2">No attendance data for this month</div>
          ) : (
            <div className="space-y-2">
              {summary.map((eng) => {
                const total = (eng.daysPresent || 0) + (eng.daysAbsent || 0);
                const pct = total > 0 ? Math.round(((eng.daysPresent || 0) / total) * 100) : 0;
                return (
                  <div key={eng.engineerId} className="flex items-center gap-3 py-1">
                    <div className="text-sm font-medium w-28 truncate shrink-0">{eng.name}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)",
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted w-20 text-right shrink-0">
                      <span className="text-success font-semibold">{eng.daysPresent || 0}P</span>
                      {" / "}
                      <span className="text-danger">{eng.daysAbsent || 0}A</span>
                      {" · "}
                      <span className="font-semibold">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
