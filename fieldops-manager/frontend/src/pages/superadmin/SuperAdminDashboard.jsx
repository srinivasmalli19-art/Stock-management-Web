import { useQuery } from "@tanstack/react-query";
import { Building2, Users, ShieldCheck, Globe } from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import Badge from "../../components/common/Badge";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import QuickActions from "../../components/dashboard/QuickActions";
import TodaySummary from "../../components/dashboard/TodaySummary";
import { formatDate } from "../../utils/formatters";

const QUICK_ACTIONS = [
  { label: "Create Organisation", icon: "ti-building-plus",  to: "/superadmin/organisations" },
  { label: "Manage Users",        icon: "ti-users",          to: "/superadmin/users"         },
  { label: "Audit Logs",          icon: "ti-clipboard-list", to: "/superadmin/audit-logs"    },
  { label: "Monitoring",          icon: "ti-activity",       to: "/superadmin/monitoring"    },
];

const StatTile = ({ icon: Icon, label, value, color = "accent" }) => {
  const colors = {
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-4xl font-extrabold leading-none">{value ?? "—"}</div>
    </div>
  );
};

export default function SuperAdminDashboard() {
  const { data: orgs, isLoading } = useQuery({
    queryKey: ["sa-organisations"],
    queryFn: () => api.get("/organisations").then((r) => r.data.data),
    staleTime: 60000,
  });

  const { data: users } = useQuery({
    queryKey: ["sa-users"],
    queryFn: () => api.get("/users").then((r) => r.data.data),
    staleTime: 60000,
  });

  const { data: widgets } = useQuery({
    queryKey: ["dashboard-widgets", "sa"],
    queryFn: () => api.get("/dashboard/widgets").then((r) => r.data.data),
    staleTime: 30000,
  });

  if (isLoading) return <PageSpinner />;

  const orgList = orgs || [];
  const userList = users || [];
  const activeOrgs = orgList.filter((o) => o.isActive).length;
  const unassigned = userList.filter((u) => !u.orgId && u.role !== "Super_Admin").length;

  const w = widgets || {};
  const today = w.today || {};
  const global = w.global || {};

  const todayStats = [
    { label: "Audit Events Today", value: today.auditEventsToday || 0, icon: "ti-activity",       color: "accent"  },
    { label: "Total Orgs",         value: global.totalOrgs       || orgList.length, icon: "ti-building",        color: "purple" },
    { label: "Active Orgs",        value: global.activeOrgs      || activeOrgs,     icon: "ti-building-check",  color: "green"  },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight flex items-center gap-2">
          <Globe size={20} className="text-purple-600" />
          Global Overview
        </h1>
        <p className="text-sm text-muted mt-0.5">All organisations and users across the platform</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile icon={Building2} label="Total Orgs" value={orgList.length} color="accent" />
        <StatTile icon={ShieldCheck} label="Active Orgs" value={activeOrgs} color="green" />
        <StatTile icon={Users} label="Total Users" value={userList.length} color="purple" />
        <StatTile icon={Users} label="Unassigned Users" value={unassigned} color={unassigned > 0 ? "amber" : "green"} />
      </div>

      {/* Phase E widgets */}
      <div className="mb-4">
        <QuickActions actions={QUICK_ACTIONS} />
      </div>

      <div className="mb-4">
        <TodaySummary stats={todayStats} />
      </div>

      <div className="mb-5">
        <ActivityTimeline />
      </div>

      <Card>
        <CardTitle>Organisations</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site Code</th>
                <th>Users</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgList.map((org) => (
                <tr key={org.id}>
                  <td className="font-medium">{org.name}</td>
                  <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{org.siteCode}</span></td>
                  <td>{org._count?.users ?? 0}</td>
                  <td><Badge status={org.isActive ? "Active" : "Inactive"} /></td>
                  <td>{formatDate(org.createdAt)}</td>
                </tr>
              ))}
              {orgList.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-4">No organisations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
