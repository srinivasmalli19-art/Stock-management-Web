import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Server, Users, Building2, Zap, ShieldCheck, BarChart2 } from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate } from "../../utils/formatters";

const ACTION_LABELS = {
  ORGANISATION_CREATED: "Organisation Created",
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  USER_ENABLED: "User Enabled",
  USER_DISABLED: "User Disabled",
  USER_ORG_REASSIGNED: "Org Reassigned",
  PASSWORD_RESET: "Password Reset",
  PASSWORD_CHANGED: "Password Changed",
  STOCK_REQUEST_CREATED: "Stock Request Created",
  STOCK_REQUEST_APPROVED: "Stock Request Approved",
  STOCK_REQUEST_REJECTED: "Stock Request Rejected",
  REVOKE_INITIATED: "Revoke Initiated",
  REVOKE_APPROVED: "Revoke Approved",
  REVOKE_REJECTED: "Revoke Rejected",
  PURCHASE_INWARD_CREATED: "Purchase Inward Created",
  PURCHASE_INWARD_APPROVED: "Purchase Inward Approved",
  PURCHASE_INWARD_REJECTED: "Purchase Inward Rejected",
  LP_CREATED: "LP Request Created",
  LP_APPROVED: "LP Approved",
  LP_REJECTED: "LP Rejected",
  CLAIM_CREATED: "Claim Created",
  CLAIM_VALIDATED: "Claim Validated",
  CLAIM_APPROVED: "Claim Approved",
  CLAIM_REJECTED: "Claim Rejected",
  ATTENDANCE_SUBMITTED: "Attendance Submitted",
  ATTENDANCE_APPROVED: "Attendance Approved",
  ATTENDANCE_REJECTED: "Attendance Rejected",
  PRODUCTIVITY_SUBMITTED: "Productivity Submitted",
  PRODUCTIVITY_VALIDATED: "Productivity Validated",
  PRODUCTIVITY_REJECTED: "Productivity Rejected (TL)",
  PRODUCTIVITY_APPROVED: "Productivity Approved",
  PRODUCTIVITY_REJECTED_BY_ADMIN: "Productivity Rejected (Admin)",
};

const ACTION_COLOR = {
  ATTENDANCE_APPROVED: "text-green-600",
  STOCK_REQUEST_APPROVED: "text-green-600",
  REVOKE_APPROVED: "text-green-600",
  PURCHASE_INWARD_APPROVED: "text-green-600",
  LP_APPROVED: "text-green-600",
  CLAIM_APPROVED: "text-green-600",
  ATTENDANCE_REJECTED: "text-red-600",
  STOCK_REQUEST_REJECTED: "text-red-600",
  REVOKE_REJECTED: "text-red-600",
  PURCHASE_INWARD_REJECTED: "text-red-600",
  LP_REJECTED: "text-red-600",
  CLAIM_REJECTED: "text-red-600",
  PRODUCTIVITY_REJECTED: "text-red-600",
  USER_DISABLED: "text-red-600",
};

const StatTile = ({ icon: Icon, label, value, sub, color = "accent" }) => {
  const colors = {
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${colors[color] || colors.accent}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold leading-none">{value ?? "—"}</div>
      {sub && <div className="text-xs opacity-60 mt-1.5">{sub}</div>}
    </div>
  );
};

const HealthPill = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
    status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === "ok" ? "bg-green-500" : "bg-red-500"}`} />
    {status === "ok" ? "Healthy" : "Error"}
  </span>
);

export default function SuperAdminMonitoring() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["sa-monitoring"],
    queryFn: () => api.get("/monitoring").then((r) => r.data.data),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (isLoading) return <PageSpinner />;

  const { overview = {}, operations = {}, recentActivity = [], health = {} } = data || {};

  const lastRefreshed = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <Activity size={20} className="text-purple-600" />
            System Monitoring
          </h1>
          <p className="text-sm text-muted mt-0.5">Global platform health and activity overview</p>
        </div>
        <div className="text-xs text-muted text-right">
          <div>Auto-refresh: 60s</div>
          <div>Last: {lastRefreshed}</div>
        </div>
      </div>

      {/* Health */}
      <Card className="mb-5">
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Server size={15} /> System Health
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-4 mt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">API Server</span>
            <HealthPill status={health.api} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Database</span>
            <HealthPill status={health.database} />
          </div>
        </div>
      </Card>

      {/* System Overview */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">System Overview</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatTile icon={Building2} label="Total Orgs" value={overview.totalOrgs} color="accent" />
          <StatTile icon={ShieldCheck} label="Active Orgs" value={overview.activeOrgs} color="green" />
          <StatTile icon={Users} label="Total Users" value={overview.totalUsers} color="purple" />
          <StatTile icon={Activity} label="Active Users" value={overview.activeUsers30d} sub="last 30 days" color="amber" />
          <StatTile icon={BarChart2} label="Audit Events" value={overview.auditEvents24h} sub="last 24 hours" color={overview.auditEvents24h > 0 ? "accent" : "green"} />
        </div>
      </div>

      {/* 24h Operations */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Operations — Last 24 Hours</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatTile icon={Zap} label="Attendance Approved" value={operations.attendanceApproved24h} color="green" />
          <StatTile icon={Zap} label="LP Approved" value={operations.lpApproved24h} color="green" />
          <StatTile icon={Zap} label="Claims Approved" value={operations.claimsApproved24h} color="green" />
          <StatTile icon={Zap} label="Stock Movements" value={operations.stockMovements24h} sub="approve + revoke + purchase" color="accent" />
        </div>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardTitle right={`${recentActivity.length} events`}>
          <span className="flex items-center gap-1.5">
            <Database size={15} /> Recent Activity Feed
          </span>
        </CardTitle>
        {recentActivity.length === 0 ? (
          <div className="text-sm text-muted py-4 text-center">No activity in the last 24 hours</div>
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th className="hidden sm:table-cell">Org</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs text-muted whitespace-nowrap">{formatDate(log.timestamp)}</td>
                    <td className="text-sm font-medium">{log.userName}</td>
                    <td className="text-xs text-muted">{log.role?.replace(/_/g, " ")}</td>
                    <td>
                      <span className={`text-xs font-semibold ${ACTION_COLOR[log.action] || "text-accent"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="text-xs text-muted">{log.entityType}</td>
                    <td className="hidden sm:table-cell text-xs text-muted font-mono">
                      {log.organisationId ? log.organisationId.slice(0, 12) + "…" : <span className="italic">Global</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
