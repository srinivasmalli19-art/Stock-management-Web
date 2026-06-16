import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import Badge from "../../components/common/Badge";

export default function SuperAdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["sa-users"],
    queryFn: () => api.get("/users", { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const { data: orgs } = useQuery({
    queryKey: ["sa-organisations"],
    queryFn: () => api.get("/organisations").then((r) => r.data.data),
  });

  const assignMut = useMutation({
    mutationFn: ({ userId, orgId }) => api.patch(`/users/${userId}/organisation`, { orgId }),
    onSuccess: () => qc.invalidateQueries(["sa-users"]),
  });

  if (isLoading) return <PageSpinner />;

  const userList = users || [];
  const orgList = orgs || [];
  const orgMap = Object.fromEntries(orgList.map((o) => [o.id, o.name]));

  const filtered = userList.filter((u) => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchOrg = !filterOrg || u.orgId === filterOrg;
    return matchSearch && matchOrg;
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users size={20} />
          All Users
        </h1>
        <p className="text-sm text-muted mt-0.5">{userList.length} users across all organisations</p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-48"
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
        >
          <option value="">All Organisations</option>
          <option value="__unassigned__">Unassigned</option>
          {orgList.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardTitle>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Organisation</th>
                <th>Status</th>
                <th>Reassign Org</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td className="text-muted text-xs">{user.email}</td>
                  <td>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      user.role === "Super_Admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.orgId
                      ? <span className="text-sm">{orgMap[user.orgId] || user.orgId}</span>
                      : <span className="text-xs text-muted italic">
                          {user.role === "Super_Admin" ? "Global (Super Admin)" : "Unassigned"}
                        </span>
                    }
                  </td>
                  <td><Badge status={user.isActive ? "Active" : "Inactive"} /></td>
                  <td>
                    {user.role !== "Super_Admin" && (
                      <select
                        className="input text-xs py-0.5 w-40"
                        value={user.orgId || ""}
                        onChange={(e) => assignMut.mutate({ userId: user.id, orgId: e.target.value || null })}
                        disabled={assignMut.isPending}
                      >
                        <option value="">— Unassigned —</option>
                        {orgList.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
