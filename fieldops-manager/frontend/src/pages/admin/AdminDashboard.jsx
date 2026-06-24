import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ClipboardCheck, Package, RotateCcw, Receipt, BadgeDollarSign,
  AlertTriangle, CalendarCheck, TrendingUp,
} from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import QuickActions from "../../components/dashboard/QuickActions";
import PendingActions from "../../components/dashboard/PendingActions";
import TodaySummary from "../../components/dashboard/TodaySummary";
import EngineerPerformanceTable from "../../components/dashboard/EngineerPerformanceTable";
import { formatCurrency, formatMonth, getCurrentMonthPrefix } from "../../utils/formatters";

const QUICK_ACTIONS = [
  { label: "User Management",      icon: "ti-users",            to: "/admin/users"                },
  { label: "LP Approvals",         icon: "ti-receipt",          to: "/admin/lp-approvals"         },
  { label: "Attendance Approvals", icon: "ti-calendar-check",   to: "/admin/attendance-approval"  },
  { label: "Audit Logs",           icon: "ti-clipboard-list",   to: "/admin/audit-logs"           },
];

const StatTile = ({ icon: Icon, label, value, sub, color = "accent", to }) => {
  const colors = {
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const inner = (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${colors[color] || colors.accent} ${to ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer" : ""}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold leading-none">{value}</div>
      {sub && <div className="text-xs mt-1.5 opacity-70">{sub}</div>}
      {to && <div className="text-[10px] mt-2.5 font-semibold opacity-60 flex items-center gap-0.5">Review <i className="ti ti-arrow-right text-[11px]" /></div>}
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
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

  const { data: widgets } = useQuery({
    queryKey: ["dashboard-widgets", "admin"],
    queryFn: () => api.get("/dashboard/widgets").then((r) => r.data.data),
    staleTime: 30000,
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

  const w = widgets || {};
  const pending = w.pending || {};
  const today = w.today || {};

  const pendingItems = [
    { label: "Productivity Approvals",  count: pending.productivity || 0, to: "/admin/approvals",            color: "amber"  },
    { label: "Purchase Inward",         count: pending.purchase     || 0, to: "/admin/purchase-approvals",   color: "accent" },
    { label: "Revoke Requests",         count: pending.revoke       || 0, to: "/admin/revoke-approvals",     color: "amber"  },
    { label: "LP Requests",             count: pending.lp           || 0, to: "/admin/lp-approvals",         color: "purple" },
    { label: "Claims",                  count: pending.claims       || 0, to: "/admin/lp-approvals",         color: "red"    },
    { label: "Staff Attendance",        count: pending.attendance   || 0, to: "/admin/attendance-approval",  color: "accent" },
  ];

  const todayStats = [
    { label: "Approvals Today", value: today.approvalsToday || 0, icon: "ti-circle-check",  color: "green"  },
    { label: "Users Created",   value: today.usersToday     || 0, icon: "ti-user-plus",     color: "accent" },
    { label: "Low Stock SKUs",  value: lowStockItems.length,      icon: "ti-alert-triangle", color: "amber"  },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{formatMonth(prefix)} — operations overview</p>
      </div>

      {/* Existing pending action tiles */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Pending Actions</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatTile icon={ClipboardCheck} label="Productivity" value={pendingProductivity} sub="awaiting approval" color={pendingProductivity > 0 ? "amber" : "green"} to="/admin/approvals" />
          <StatTile icon={Package} label="Purchase Inward" value={pendingPurchase} sub="awaiting approval" color={pendingPurchase > 0 ? "amber" : "green"} to="/admin/purchase-approvals" />
          <StatTile icon={RotateCcw} label="Revoke Requests" value={pendingRevoke} sub="awaiting review" color={pendingRevoke > 0 ? "amber" : "green"} to="/admin/revoke-approvals" />
          <StatTile icon={Receipt} label="LP Requests" value={pendingLP} sub="awaiting approval" color={pendingLP > 0 ? "purple" : "green"} to="/admin/lp-approvals" />
          <StatTile icon={BadgeDollarSign} label="Claims" value={pendingClaims} sub="awaiting final approval" color={pendingClaims > 0 ? "red" : "green"} to="/admin/lp-approvals?tab=claims" />
        </div>
      </div>

      {/* Phase E widgets */}
      <div className="mb-4">
        <QuickActions actions={QUICK_ACTIONS} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PendingActions items={pendingItems} />
        <TodaySummary stats={todayStats} />
      </div>

      <EngineerPerformanceTable />

      <div className="mb-5">
        <ActivityTimeline />
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
