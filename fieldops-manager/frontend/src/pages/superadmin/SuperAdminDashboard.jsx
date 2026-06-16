import { useQuery } from "@tanstack/react-query";
import { Building2, Users, ShieldCheck, Globe } from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import Badge from "../../components/common/Badge";
import { formatDate } from "../../utils/formatters";

const StatTile = ({ icon: Icon, label, value, color = "accent" }) => {
  const colors = {
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value ?? "—"}</div>
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

  if (isLoading) return <PageSpinner />;

  const orgList = orgs || [];
  const userList = users || [];
  const activeOrgs = orgList.filter((o) => o.isActive).length;
  const unassigned = userList.filter((u) => !u.orgId && u.role !== "Super_Admin").length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Globe size={20} className="text-purple-600" />
          Super Admin — Global Overview
        </h1>
        <p className="text-sm text-muted mt-0.5">All organisations and users across the platform</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile icon={Building2} label="Total Orgs" value={orgList.length} color="accent" />
        <StatTile icon={ShieldCheck} label="Active Orgs" value={activeOrgs} color="green" />
        <StatTile icon={Users} label="Total Users" value={userList.length} color="purple" />
        <StatTile icon={Users} label="Unassigned Users" value={unassigned} color={unassigned > 0 ? "amber" : "green"} />
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
