import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import Card, { CardTitle } from "../common/Card";
import EmptyState from "../common/EmptyState";
import { PageSpinner } from "../common/Spinner";
import { formatCurrency, getCurrentMonthPrefix, formatMonth } from "../../utils/formatters";

const stepMonth = (prefix, delta) => {
  const current = getCurrentMonthPrefix();
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return next > current ? current : next;
};

const COLS = [
  { key: "name",           label: "Engineer Name",   mobile: true  },
  { key: "daysPresent",    label: "Days Present",     mobile: false },
  { key: "callsClosed",    label: "Calls Closed",     mobile: true  },
  { key: "revenue",        label: "Revenue",          mobile: false },
  { key: "perCallRevenue", label: "Per Call Revenue", mobile: false },
  { key: "rcpGenerated",   label: "RCP Generated",    mobile: true  },
];

export default function EngineerPerformanceTable() {
  const [prefix, setPrefix] = useState(getCurrentMonthPrefix);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const currentPrefix = getCurrentMonthPrefix();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["engineer-performance", prefix],
    queryFn: () => api.get("/dashboard/engineer-performance", { params: { month: prefix } }).then((r) => r.data.data),
    staleTime: 60000,
  });

  const data = useMemo(() => {
    const list = rawData || [];
    const filtered = filter
      ? list.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
      : list;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rawData, filter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <i className="ti ti-arrows-sort text-[10px] text-muted/40 ml-0.5" />;
    return <i className={`ti ti-arrow-${sortDir === "asc" ? "up" : "down"} text-[10px] text-accent ml-0.5`} />;
  };

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <CardTitle>Engineer Performance — {formatMonth(prefix)}</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => setPrefix(stepMonth(prefix, -1))} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-bg cursor-pointer">
            <i className="ti ti-chevron-left text-sm" />
          </button>
          <span className="text-xs font-semibold text-muted min-w-[90px] text-center">{formatMonth(prefix)}</span>
          <button onClick={() => setPrefix(stepMonth(prefix, 1))} disabled={prefix === currentPrefix} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-bg cursor-pointer disabled:opacity-40">
            <i className="ti ti-chevron-right text-sm" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="input w-full max-w-[260px] text-sm"
          placeholder="Filter by name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : data.length === 0 ? (
        <EmptyState icon="ti-users-group" message="No engineer data for this month" sub="Approved productivity logs will appear here." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  {COLS.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="cursor-pointer select-none whitespace-nowrap">
                      {col.label} <SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.daysPresent}</td>
                    <td>{row.callsClosed}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>{row.callsClosed > 0 ? formatCurrency(row.perCallRevenue) : <span className="text-muted">—</span>}</td>
                    <td>{row.rcpGenerated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {data.map((row) => (
              <div key={row.id} className="border border-border rounded-xl p-3.5">
                <div className="font-semibold text-sm mb-2">{row.name}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted block">Calls</span><strong>{row.callsClosed}</strong></div>
                  <div><span className="text-muted block">RCP</span><strong>{row.rcpGenerated}</strong></div>
                  <div><span className="text-muted block">Days</span><strong>{row.daysPresent}</strong></div>
                  <div className="col-span-2"><span className="text-muted block">Revenue</span><strong>{formatCurrency(row.revenue)}</strong></div>
                  <div><span className="text-muted block">Per Call</span><strong>{row.callsClosed > 0 ? formatCurrency(row.perCallRevenue) : "—"}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
