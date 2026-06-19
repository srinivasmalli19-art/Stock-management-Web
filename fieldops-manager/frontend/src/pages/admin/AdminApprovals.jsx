import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { productivityService } from "../../services/productivityService";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import IncentivePill from "../../components/common/IncentivePill";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { inputClass } from "../../components/common/FormField";
import { formatDate, formatCurrency, buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";

export default function AdminApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [incentives, setIncentives] = useState({});
  const [confirmReject, setConfirmReject] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-approvals"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, items, adminNote }) =>
      action === "Approved"
        ? productivityService.approveLog(id, { items, adminNote })
        : productivityService.rejectAdmin(id, { adminNote }),
    onSuccess: (_, { action }) => {
      toast.success(action === "Approved" ? "Approved successfully! Attendance marked & stock deducted." : "Entry rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-approvals"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const handleExport = () => {
    const all = data || [];
    const exportRows = all.filter((l) => l.status === "Approved");
    const headers = ["Engineer", "Date", "Calls Closed", "Revenue (₹)", "Incentive Awarded (₹)", "Status"];
    const rows = exportRows.map((l) => {
      const rev = (l.items || []).reduce((s, i) => s + i.saleValue, 0);
      const inc = (l.items || []).reduce((s, i) => s + (i.adminIncentive || 0), 0);
      return [l.engineer?.name, formatDate(l.date), l.callsClosed, rev.toFixed(2), inc.toFixed(2), l.status];
    });
    triggerDownload(buildCsvBlob(headers, rows), `productivity-logs-${todayStr()}.csv`);
  };

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const pending = all.filter((l) => l.status === "Validated");
  const approved = all.filter((l) => l.status === "Approved");

  const tabs = [
    { key: "pending", label: `Awaiting Approval (${pending.length})` },
    { key: "approved", label: `Approved (${approved.length})` },
  ];

  const getIncentive = (logId, itemId, fallback) => {
    const key = `${logId}_${itemId}`;
    return incentives[key] !== undefined ? incentives[key] : (fallback || 0);
  };

  const setIncentive = (logId, itemId, value) => {
    setIncentives((prev) => ({ ...prev, [`${logId}_${itemId}`]: parseFloat(value) || 0 }));
  };

  const getTotalIncentive = (log) =>
    (log.items || []).reduce((s, item) => s + getIncentive(log.id, item.id, item.adminIncentive), 0);

  const handleApprove = (log) => {
    const items = (log.items || []).map((item) => ({
      id: item.id,
      adminIncentive: getIncentive(log.id, item.id, item.adminIncentive),
    }));
    mutation.mutate({ id: log.id, action: "Approved", items });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Productivity Approval Queue</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={handleExport} title="Export approved logs as CSV">
            <i className="ti ti-download" /> CSV
          </Button>
          <Badge status="Validated">{pending.length} awaiting</Badge>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <EmptyState icon="ti-check-circle" message="No entries pending approval!" />
          ) : (
            pending.map((log) => {
              const lrev = (log.items || []).reduce((s, i) => s + i.saleValue, 0);
              const totalInc = getTotalIncentive(log);
              return (
                <Card key={log.id} className="mb-3.5">
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <strong>{log.engineer?.name}</strong>{" "}
                      <SkuTag id={log.id.slice(0, 12)} />
                      <br />
                      <span className="text-xs text-muted">
                        {formatDate(log.date)} · {log.callsClosed} calls · {formatCurrency(lrev)}
                      </span>
                    </div>
                    <Badge status="Validated">Validated by TL</Badge>
                  </div>

                  {log.tlNote && (
                    <div className="text-xs px-2.5 py-2 bg-cyan-50 rounded text-cyan-800 mb-2.5 flex items-center gap-1.5">
                      <i className="ti ti-message-circle" /> TL: {log.tlNote}
                    </div>
                  )}

                  {log.items?.length > 0 ? (
                    <div className="border-2 border-accent rounded-lg overflow-hidden mb-3">
                      <div className="bg-accent2 px-3 py-2">
                        <span className="text-xs font-bold text-accent uppercase tracking-wide">
                          <i className="ti ti-pencil text-sm align-[-1px] mr-1" />
                          Enter Incentive per Accessory
                        </span>
                      </div>
                      {log.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 border-b border-border text-xs last:border-b-0">
                          <div>
                            <SkuTag id={item.skuId} />
                            <span className="ml-2">{item.sku?.name} <span className="text-muted">× {item.qty}</span></span>
                          </div>
                          <div className="text-muted">{formatCurrency(item.saleValue)}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted whitespace-nowrap">Incentive ₹</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={getIncentive(log.id, item.id, item.adminIncentive)}
                              onChange={(e) => setIncentive(log.id, item.id, e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-accent rounded text-xs font-semibold bg-accent2 text-accent outline-none"
                            />
                          </div>
                          <div className="text-[10px] text-muted whitespace-nowrap">prev: {formatCurrency(item.adminIncentive || 0)}</div>
                        </div>
                      ))}
                      <div className="px-3 py-2.5 bg-bg flex justify-between items-center">
                        <span className="text-xs font-semibold text-muted">Total Incentive to Award</span>
                        <IncentivePill amount={totalInc} />
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-bg rounded text-xs text-muted mb-3">No accessories sold.</div>
                  )}

                  <div className="px-2.5 py-2 bg-green-50 rounded text-xs text-green-800 mb-2.5">
                    <i className="ti ti-calendar-check text-sm mr-1" />
                    Approving marks <strong>{log.engineer?.name}</strong> as <strong>Present</strong> on {formatDate(log.date)} and deducts sold accessories from van stock.
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="danger" size="sm" onClick={() => setConfirmReject(log)} disabled={mutation.isPending}>
                      <i className="ti ti-x" /> Reject
                    </Button>
                    <Button variant="success" size="sm" onClick={() => handleApprove(log)} disabled={mutation.isPending}>
                      <i className="ti ti-check" /> Approve & Save Incentive
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmReject}
        title="Reject Productivity Log?"
        message={`${confirmReject?.engineer?.name}'s log for ${formatDate(confirmReject?.date)} will be rejected and returned to them.`}
        confirmLabel="Reject Log"
        variant="danger"
        loading={mutation.isPending}
        onConfirm={() => {
          mutation.mutate({ id: confirmReject.id, action: "Rejected" });
          setConfirmReject(null);
        }}
        onCancel={() => setConfirmReject(null)}
      />

      {tab === "approved" && (
        <Card>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr><th>ID</th><th>Engineer</th><th>Date</th><th>Calls</th><th>Revenue</th><th>Incentive Awarded</th><th>Status</th></tr>
              </thead>
              <tbody>
                {approved.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="No approved entries" /></td></tr>
                ) : (
                  approved.map((l) => {
                    const totalInc = (l.items || []).reduce((s, i) => s + (i.adminIncentive || 0), 0);
                    return (
                      <tr key={l.id}>
                        <td className="text-xs text-muted">{l.id.slice(0, 12)}…</td>
                        <td>{l.engineer?.name}</td>
                        <td>{formatDate(l.date)}</td>
                        <td>{l.callsClosed}</td>
                        <td>{formatCurrency((l.items || []).reduce((s, i) => s + i.saleValue, 0))}</td>
                        <td><IncentivePill amount={totalInc} /></td>
                        <td><Badge status="Approved" /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
