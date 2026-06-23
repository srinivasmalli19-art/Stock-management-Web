import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import FormField, { inputClass, selectClass } from "../../components/common/FormField";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency, getCurrentMonthPrefix, getMonthRange, formatMonth } from "../../utils/formatters";

const STATUSES = ["Pending", "Validated", "Approved", "Rejected"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const clampPrefix = (prefix) => {
  const current = getCurrentMonthPrefix();
  const [cy, cm] = current.split("-").map(Number);
  const [py, pm] = prefix.split("-").map(Number);
  if (py > cy || (py === cy && pm > cm)) return current;
  const diff = (cy - py) * 12 + (cm - pm);
  if (diff > 12) {
    const d = new Date(cy, cm - 13, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return prefix;
};

const stepMonth = (prefix, delta) => {
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return clampPrefix(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
};

export default function EngProductivity() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [tab, setTab] = useState("log"); // "log" | "history"
  const [prefix, setPrefix] = useState(getCurrentMonthPrefix);
  const { daysInMonth } = getMonthRange(prefix);
  const currentPrefix = getCurrentMonthPrefix();

  // ── Log form state ──────────────────────────────────────────────────────────
  const [date, setDate] = useState(today);
  const [calls, setCalls] = useState("");
  const [rcpGenerated, setRcpGenerated] = useState("");
  const [lineItems, setLineItems] = useState([]);

  // ── Resubmit modal state ────────────────────────────────────────────────────
  const [resubmitLog, setResubmitLog] = useState(null);
  const [rsCalls, setRsCalls] = useState("");
  const [rsRcp, setRsRcp] = useState("");
  const [rsItems, setRsItems] = useState([]);

  const { data: skusRes } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });
  const skus = skusRes || [];

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ["productivity", "mine"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
  });

  const { data: attRes, isLoading: attLoading } = useQuery({
    queryKey: ["attendance", prefix, currentUser?.id],
    queryFn: () =>
      api.get("/attendance", { params: { month: prefix, engineerId: currentUser?.id } }).then((r) => r.data.data),
  });

  // ── Submit new log ──────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/productivity", data),
    onSuccess: () => {
      toast.success("Productivity logged! Awaiting Team Leader validation.");
      queryClient.invalidateQueries({ queryKey: ["productivity"] });
      queryClient.invalidateQueries({ queryKey: ["eng-dashboard"] });
      setDate(today);
      setCalls("");
      setRcpGenerated("");
      setLineItems([]);
      setTab("history");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit log"),
  });

  // ── Resubmit rejected log ───────────────────────────────────────────────────
  const resubmitMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/productivity/${id}/resubmit`, data),
    onSuccess: () => {
      toast.success("Log resubmitted for validation!");
      queryClient.invalidateQueries({ queryKey: ["productivity"] });
      setResubmitLog(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Resubmit failed"),
  });

  const addLine = () =>
    setLineItems([...lineItems, { id: Date.now(), skuId: skus[0]?.id || "", qty: "", saleValue: "" }]);
  const removeLine = (id) => setLineItems(lineItems.filter((l) => l.id !== id));
  const updateLine = (id, field, value) =>
    setLineItems(lineItems.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const handleSubmit = () => {
    if (!date) { toast.error("Please select a date"); return; }
    const items = lineItems
      .filter((l) => parseInt(l.qty) > 0)
      .map((l) => ({ skuId: l.skuId, qty: parseInt(l.qty), saleValue: parseFloat(l.saleValue) || 0 }));
    createMutation.mutate({ date, callsClosed: parseInt(calls) || 0, rcpGenerated: parseInt(rcpGenerated) || 0, items });
  };

  const openResubmit = (log) => {
    setResubmitLog(log);
    setRsCalls(String(log.callsClosed));
    setRsRcp(String(log.rcpGenerated || 0));
    setRsItems((log.items || []).map((i) => ({ id: Date.now() + Math.random(), skuId: i.skuId, qty: String(i.qty), saleValue: String(i.saleValue) })));
  };

  const handleResubmit = () => {
    const items = rsItems
      .filter((l) => parseInt(l.qty) > 0)
      .map((l) => ({ skuId: l.skuId, qty: parseInt(l.qty), saleValue: parseFloat(l.saleValue) || 0 }));
    resubmitMutation.mutate({ id: resubmitLog.id, data: { callsClosed: parseInt(rsCalls) || 0, rcpGenerated: parseInt(rsRcp) || 0, items } });
  };

  const addRsLine = () =>
    setRsItems([...rsItems, { id: Date.now(), skuId: skus[0]?.id || "", qty: "", saleValue: "" }]);
  const removeRsLine = (id) => setRsItems(rsItems.filter((l) => l.id !== id));
  const updateRsLine = (id, field, value) =>
    setRsItems(rsItems.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const logs = logsRes || [];
  const att = attRes || [];

  // Build attendance calendar
  const attMap = {};
  att.forEach((a) => { attMap[new Date(a.date).toISOString().split("T")[0]] = a.status; });
  const firstDow = new Date(`${prefix}-01`).getDay();
  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${prefix}-${String(d).padStart(2, "0")}`;
    const past = new Date(ds) < new Date(today);
    calCells.push({ d, ds, isToday: ds === today, status: attMap[ds], past });
  }
  const presentDays = att.filter((a) => a.status === "Present").length;
  const pastDays = calCells.filter((c) => !c.empty && c.past).length;
  const pct = pastDays > 0 ? Math.round((presentDays / pastDays) * 100) : 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-4xl font-bold text-text">Productivity & Attendance</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-bg rounded-xl p-1 w-fit border border-border">
        {[["log", "ti-clipboard-plus", "Log Today"], ["history", "ti-calendar-stats", "My History"]].map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              tab === key ? "bg-white text-accent shadow-card font-semibold" : "text-muted hover:text-text"
            }`}
          >
            <i className={`ti ${icon} text-base`} />
            {label}
          </button>
        ))}
      </div>

      {/* ── LOG TODAY TAB ──────────────────────────────────────────────────── */}
      {tab === "log" && (
        <Card className="max-w-[680px]">
          <FormField label="Date" required>
            <input type="date" className={inputClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <FormField label="Calls Closed">
            <input type="number" className={inputClass} min={0} max={30} value={calls} onChange={(e) => setCalls(e.target.value)} placeholder="Number of service calls closed today" />
          </FormField>

          <FormField label="RCP Generated">
            <input type="number" className={inputClass} min={0} value={rcpGenerated} onChange={(e) => setRcpGenerated(e.target.value)} placeholder="RCP units generated today" />
          </FormField>

          <hr className="border-border my-5" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Accessories Sold</h3>
            <span className="text-xs text-muted">Optional</span>
          </div>

          {lineItems.map((line) => (
            <div key={line.id} className="line-item-row">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">SKU</label>
                <select className={selectClass} value={line.skuId} onChange={(e) => updateLine(line.id, "skuId", e.target.value)}>
                  {skus.map((s) => <option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Qty Sold</label>
                <input type="number" className={inputClass} min={1} value={line.qty} onChange={(e) => updateLine(line.id, "qty", e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Sale Value (₹)</label>
                <input type="number" className={inputClass} min={0} value={line.saleValue} onChange={(e) => updateLine(line.id, "saleValue", e.target.value)} placeholder="0" />
              </div>
              <div className="pb-0.5 flex items-end">
                <Button variant="danger" size="sm" onClick={() => removeLine(line.id)}><i className="ti ti-x" /></Button>
              </div>
            </div>
          ))}

          <Button variant="ghost" size="sm" onClick={addLine} className="mb-5">
            <i className="ti ti-plus" /> Add Accessory Line
          </Button>

          <hr className="border-border my-5" />
          <div className="flex gap-2 justify-end">
            <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending}>
              <i className="ti ti-send" />
              {createMutation.isPending ? "Submitting..." : "Submit for Validation"}
            </Button>
          </div>
        </Card>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {tab === "history" && (
        <>
          {(logsLoading || attLoading) ? <PageSpinner /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Attendance Calendar */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <Button size="sm" variant="ghost" onClick={() => setPrefix(stepMonth(prefix, -1))}>
                    <i className="ti ti-chevron-left text-sm" />
                  </Button>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{formatMonth(prefix)}</div>
                    <div className="text-xs text-muted mt-0.5">
                      <span className="text-success font-medium">{presentDays} present</span>
                      {" · "}
                      <span className="text-danger">{pastDays - presentDays} absent</span>
                      {pastDays > 0 && (
                        <span className="ml-2 font-bold" style={{ color: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)" }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setPrefix(stepMonth(prefix, 1))} disabled={prefix === currentPrefix}>
                    <i className="ti ti-chevron-right text-sm" />
                  </Button>
                </div>
                {pastDays > 0 && (
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)" }} />
                  </div>
                )}
                <div className="cal-header">
                  {DAY_NAMES.map((d) => <span key={d} className="text-center text-[10px] font-semibold text-muted uppercase">{d}</span>)}
                </div>
                <div className="cal-grid">
                  {calCells.map((cell, i) => {
                    if (cell.empty) return <div key={i} />;
                    let cls = "cal-day text-sm font-medium ";
                    if (cell.isToday) cls += "border-2 border-accent ";
                    if (cell.status === "Present") cls += "bg-green-100 text-green-800 ";
                    else if (cell.past && !cell.status) cls += "bg-red-50 text-red-700 ";
                    else cls += "text-muted ";
                    return <div key={i} className={cls}>{cell.d}</div>;
                  })}
                </div>
                <div className="flex gap-3 mt-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />Present</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-300" />Absent</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-accent" />Today</span>
                </div>
              </Card>

              {/* Status Summary */}
              <Card>
                <CardTitle>Entry Status Summary</CardTitle>
                {STATUSES.map((s) => (
                  <div key={s} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <Badge status={s} />
                    <strong>{logs.filter((l) => l.status === s).length} entries</strong>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* All Logs Table */}
          <Card>
            <CardTitle>All Productivity Logs</CardTitle>
            {logs.length === 0 ? (
              <EmptyState icon="ti-clipboard-off" message="No logs submitted yet" sub="Use the Log Today tab to submit your first productivity entry." />
            ) : (
              <div className="overflow-x-auto tbl">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Calls</th>
                      <th>RCP</th>
                      <th>Revenue</th>
                      <th>Status</th>
                      <th>TL Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.date)}</td>
                        <td>{log.callsClosed}</td>
                        <td>{log.rcpGenerated || 0}</td>
                        <td>{formatCurrency((log.items || []).reduce((s, i) => s + i.saleValue, 0))}</td>
                        <td><Badge status={log.status} /></td>
                        <td className="text-xs text-muted">{log.tlNote || log.adminNote || "—"}</td>
                        <td>
                          {log.status === "Rejected" && (
                            <Button variant="warn" size="sm" onClick={() => openResubmit(log)}>
                              <i className="ti ti-refresh" /> Resubmit
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── RESUBMIT MODAL ─────────────────────────────────────────────────── */}
      <Modal open={!!resubmitLog} onClose={() => setResubmitLog(null)} title={`Resubmit Log — ${resubmitLog ? formatDate(resubmitLog.date) : ""}`}>
        <FormField label="Calls Closed">
          <input type="number" className={inputClass} min={0} max={30} value={rsCalls} onChange={(e) => setRsCalls(e.target.value)} />
        </FormField>
        <FormField label="RCP Generated">
          <input type="number" className={inputClass} min={0} value={rsRcp} onChange={(e) => setRsRcp(e.target.value)} />
        </FormField>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold">Accessories Sold</label>
          <Button variant="ghost" size="sm" onClick={addRsLine}><i className="ti ti-plus" /> Add</Button>
        </div>
        {rsItems.map((line) => (
          <div key={line.id} className="line-item-row mb-2">
            <select className={selectClass} value={line.skuId} onChange={(e) => updateRsLine(line.id, "skuId", e.target.value)}>
              {skus.map((s) => <option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
            <input type="number" className={inputClass} placeholder="Qty" min={1} value={line.qty} onChange={(e) => updateRsLine(line.id, "qty", e.target.value)} />
            <input type="number" className={inputClass} placeholder="₹ Value" min={0} value={line.saleValue} onChange={(e) => updateRsLine(line.id, "saleValue", e.target.value)} />
            <Button variant="danger" size="sm" onClick={() => removeRsLine(line.id)}><i className="ti ti-x" /></Button>
          </div>
        ))}
        <div className="flex gap-2 justify-end mt-4">
          <Button onClick={() => setResubmitLog(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleResubmit} disabled={resubmitMutation.isPending}>
            <i className="ti ti-send" /> {resubmitMutation.isPending ? "Submitting..." : "Resubmit"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
