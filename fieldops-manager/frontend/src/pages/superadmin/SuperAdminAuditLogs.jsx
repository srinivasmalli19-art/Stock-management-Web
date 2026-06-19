import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { PageSpinner } from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";

const LIMIT = 50;

const ACTION_LABELS = {
  // Organisation
  ORGANISATION_CREATED: "Organisation Created",
  // User
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  USER_ENABLED: "User Enabled",
  USER_DISABLED: "User Disabled",
  USER_ORG_REASSIGNED: "User Org Reassigned",
  PASSWORD_RESET: "Password Reset",
  PASSWORD_CHANGED: "Password Changed",
  // Stock
  STOCK_REQUEST_CREATED: "Stock Request Created",
  STOCK_REQUEST_APPROVED: "Stock Request Approved",
  STOCK_REQUEST_REJECTED: "Stock Request Rejected",
  REVOKE_INITIATED: "Revoke Initiated",
  REVOKE_APPROVED: "Revoke Approved",
  REVOKE_REJECTED: "Revoke Rejected",
  // Purchase
  PURCHASE_INWARD_CREATED: "Purchase Inward Created",
  PURCHASE_INWARD_APPROVED: "Purchase Inward Approved",
  PURCHASE_INWARD_REJECTED: "Purchase Inward Rejected",
  // LP
  LP_CREATED: "LP Created",
  LP_APPROVED: "LP Approved",
  LP_REJECTED: "LP Rejected",
  // Claims
  CLAIM_CREATED: "Claim Created",
  CLAIM_VALIDATED: "Claim Validated",
  CLAIM_APPROVED: "Claim Approved",
  CLAIM_REJECTED: "Claim Rejected",
  // Attendance
  ATTENDANCE_SUBMITTED: "Attendance Submitted",
  ATTENDANCE_APPROVED: "Attendance Approved",
  ATTENDANCE_REJECTED: "Attendance Rejected",
  // Productivity
  PRODUCTIVITY_SUBMITTED: "Productivity Submitted",
  PRODUCTIVITY_VALIDATED: "Productivity Validated",
  PRODUCTIVITY_REJECTED: "Productivity Rejected",
};

const ENTITY_TYPES = [
  "Organisation", "User", "StockRequest", "RevokeRequest",
  "PurchaseInward", "LpRequest", "ClaimRequest", "StaffAttendance", "Productivity",
];

const ROLES = ["Super_Admin", "Admin", "Store_Manager", "Team_Leader", "Engineer"];

function actionBadgeClass(action) {
  if (action.includes("APPROVED") || action.includes("VALIDATED") || action.includes("ENABLED"))
    return "bg-green-100 text-green-800";
  if (action.includes("REJECTED") || action.includes("DISABLED"))
    return "bg-red-100 text-red-800";
  if (action.includes("CREATED") || action.includes("SUBMITTED"))
    return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-700";
}

const formatDateTime = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const prettyJson = (v) => {
  if (v == null) return "—";
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

export default function SuperAdminAuditLogs() {
  const [filters, setFilters] = useState({ from: "", to: "", action: "", entityType: "", role: "", orgId: "" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const { data: orgs } = useQuery({
    queryKey: ["organisations-for-audit"],
    queryFn: () => api.get("/organisations").then((r) => r.data.data || []),
    staleTime: 60000,
  });
  const orgMap = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));

  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };
  const clearFilters = () => {
    setFilters({ from: "", to: "", action: "", entityType: "", role: "", orgId: "" });
    setPage(1);
  };

  const activeParams = {
    page,
    limit: LIMIT,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  };

  const { data: res, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs-sa", activeParams],
    queryFn: () => api.get("/audit-logs", { params: activeParams }).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 15000,
  });

  const logs = res?.data || [];
  const pg = res?.pagination || {};

  const handleExport = () => {
    if (logs.length === 0) { toast.warn("No data to export"); return; }
    const headers = ["Date/Time", "User", "Role", "Organisation", "Action", "Entity Type", "Entity ID", "IP Address"];
    const rows = logs.map((l) => [
      formatDateTime(l.createdAt),
      l.userName,
      l.role,
      l.organisationId ? (orgMap[l.organisationId] || l.organisationId) : "Global (Super Admin)",
      ACTION_LABELS[l.action] || l.action,
      l.entityType,
      l.entityId,
      l.ipAddress || "",
    ]);
    triggerDownload(buildCsvBlob(headers, rows), `global-audit-logs-${todayStr()}.csv`);
    toast.success("Exported!");
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Global Audit Logs</h1>
          <p className="text-sm text-muted mt-0.5">All user actions across all organisations</p>
        </div>
        <Button size="sm" onClick={handleExport} disabled={logs.length === 0}>
          <i className="ti ti-download" /> Export CSV
        </Button>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={filters.from}
              onChange={(e) => setFilter("from", e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filters.to}
              onChange={(e) => setFilter("to", e.target.value)} />
          </div>
          <div>
            <label className="label">Action</label>
            <select className="input" value={filters.action} onChange={(e) => setFilter("action", e.target.value)}>
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select className="input" value={filters.entityType} onChange={(e) => setFilter("entityType", e.target.value)}>
              <option value="">All Types</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={filters.role} onChange={(e) => setFilter("role", e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Organisation</label>
            <select className="input" value={filters.orgId} onChange={(e) => setFilter("orgId", e.target.value)}>
              <option value="">All Organisations</option>
              {(orgs || []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button variant="default" fullWidth onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardTitle right={pg.total != null ? `${pg.total.toLocaleString()} event${pg.total !== 1 ? "s" : ""}` : ""}>
            Audit Events
            {isFetching && !isLoading && (
              <span className="text-xs text-muted font-normal ml-2">Updating…</span>
            )}
          </CardTitle>

          {logs.length === 0 ? (
            <EmptyState icon="ti-shield-search" message="No audit events match your filters" />
          ) : (
            <>
              <div className="overflow-x-auto tbl">
                <table>
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Organisation</th>
                      <th>Action</th>
                      <th>Entity Type</th>
                      <th>Entity ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelected(log)}
                      >
                        <td className="text-xs text-muted whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="font-medium text-sm">{log.userName}</td>
                        <td className="text-xs text-muted">{log.role?.replace(/_/g, " ")}</td>
                        <td className="text-sm text-muted">
                          {log.organisationId
                            ? (orgMap[log.organisationId] || log.organisationId.slice(0, 12) + "…")
                            : <span className="text-xs text-purple-600 font-medium">Global</span>}
                        </td>
                        <td>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionBadgeClass(log.action)}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="text-sm text-muted">{log.entityType}</td>
                        <td className="font-mono text-xs text-muted">{log.entityId.slice(0, 16)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted">
                  Page {pg.page ?? 1} of {pg.totalPages ?? 1} · {pg.total?.toLocaleString() ?? 0} records
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="default"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1 || isFetching}>
                    <i className="ti ti-chevron-left" /> Prev
                  </Button>
                  <Button size="sm" variant="default"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pg.totalPages || page >= pg.totalPages || isFetching}>
                    Next <i className="ti ti-chevron-right" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Audit Event Details" width="540px">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 bg-gray-50 rounded-lg p-4">
              <div>
                <div className="text-xs text-muted mb-0.5">Timestamp</div>
                <div className="font-medium text-xs">
                  {new Date(selected.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Action</div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionBadgeClass(selected.action)}`}>
                  {ACTION_LABELS[selected.action] || selected.action}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">User</div>
                <div className="font-medium">{selected.userName}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Role</div>
                <div>{selected.role?.replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Organisation</div>
                <div className="text-sm">
                  {selected.organisationId
                    ? (orgMap[selected.organisationId] || selected.organisationId)
                    : <span className="text-purple-600 font-medium">Global (Super Admin)</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Entity</div>
                <div className="text-sm">{selected.entityType}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted mb-0.5">Entity ID</div>
                <div className="font-mono text-xs break-all">{selected.entityId}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">IP Address</div>
                <div className="font-mono text-xs">{selected.ipAddress || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">User Agent</div>
                <div className="text-xs text-muted truncate" title={selected.userAgent || "—"}>
                  {selected.userAgent || "—"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Old Value</div>
              <pre className="bg-gray-50 border border-border rounded p-3 text-xs overflow-auto max-h-40 text-gray-700 whitespace-pre-wrap">
                {prettyJson(selected.oldValue)}
              </pre>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">New Value</div>
              <pre className="bg-gray-50 border border-border rounded p-3 text-xs overflow-auto max-h-40 text-gray-700 whitespace-pre-wrap">
                {prettyJson(selected.newValue)}
              </pre>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
