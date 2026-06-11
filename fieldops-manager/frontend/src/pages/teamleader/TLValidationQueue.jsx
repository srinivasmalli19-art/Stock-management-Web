import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { productivityService } from "../../services/productivityService";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { inputClass } from "../../components/common/FormField";
import { formatDate, formatCurrency } from "../../utils/formatters";

export default function TLValidationQueue() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [notes, setNotes] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["tl-queue"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, tlNote }) =>
      action === "Validated"
        ? productivityService.validateLog(id, { tlNote })
        : productivityService.rejectTL(id, { tlNote }),
    onSuccess: (_, { action }) => {
      toast.success(action === "Validated" ? "Validated and sent to Admin!" : "Entry rejected.");
      queryClient.invalidateQueries({ queryKey: ["tl-queue"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  if (isLoading) return <PageSpinner />;

  const allLogs = data || [];
  const pending = allLogs.filter((l) => l.status === "Pending");
  const validated = allLogs.filter((l) => l.status === "Validated");

  const tabs = [
    { key: "pending", label: `Pending (${pending.length})` },
    { key: "validated", label: `Validated (${validated.length})` },
  ];

  const handleAction = (id, action) => {
    mutation.mutate({ id, action, tlNote: notes[id] || "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Validation Queue</h1>
        <Badge status="Pending">{pending.length} Pending</Badge>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <EmptyState icon="ti-check-circle" message="All caught up! No pending entries." />
          ) : (
            pending.map((log) => {
              const lrev = (log.items || []).reduce((s, i) => s + i.saleValue, 0);
              return (
                <Card key={log.id} className="mb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <strong>{log.engineer?.name}</strong>{" "}
                      <SkuTag id={log.id.slice(0, 12)} />
                      <br />
                      <span className="text-xs text-muted">
                        {formatDate(log.date)} · {log.callsClosed} calls · {formatCurrency(lrev)}
                      </span>
                    </div>
                    <Badge status="Pending" />
                  </div>

                  {log.items?.length > 0 && (
                    <div className="mb-3 p-2.5 bg-bg rounded text-xs text-muted">
                      {log.items.map((i, idx) => (
                        <span key={idx}>
                          {i.sku?.name || i.skuId} × {i.qty} = {formatCurrency(i.saleValue)}
                          {idx < log.items.length - 1 ? " | " : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Add a note for Admin..."
                      value={notes[log.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [log.id]: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleAction(log.id, "Rejected")}
                      disabled={mutation.isPending}
                    >
                      <i className="ti ti-x" /> Reject
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleAction(log.id, "Validated")}
                      disabled={mutation.isPending}
                    >
                      <i className="ti ti-check" /> Validate & Send to Admin
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "validated" && (
        <Card>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr><th>ID</th><th>Engineer</th><th>Date</th><th>Calls</th><th>Status</th><th>Note</th></tr>
              </thead>
              <tbody>
                {validated.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState message="No validated entries" /></td></tr>
                ) : (
                  validated.map((l) => (
                    <tr key={l.id}>
                      <td className="text-xs text-muted">{l.id.slice(0, 12)}…</td>
                      <td>{l.engineer?.name}</td>
                      <td>{formatDate(l.date)}</td>
                      <td>{l.callsClosed}</td>
                      <td><Badge status={l.status} /></td>
                      <td className="text-xs text-muted">{l.tlNote || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
