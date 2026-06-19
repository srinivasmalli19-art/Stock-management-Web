import { formatMonth, getMonthRange } from "../../utils/formatters";
import Button from "./Button";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function cellClass(rec, isPast, isToday) {
  let base = "cal-day text-sm font-medium ";
  if (isToday) base += "ring-2 ring-accent ring-offset-1 ";
  if (!rec) {
    if (isPast) return base + "bg-red-50 text-red-300";
    return base + "text-gray-300";
  }
  if (rec.submissionStatus === "Pending") return base + "bg-amber-100 text-amber-700";
  if (rec.submissionStatus === "Rejected") return base + "bg-rose-100 text-rose-700";
  if (rec.attendanceStatus === "Present") return base + "bg-green-100 text-green-800";
  if (rec.attendanceStatus === "Leave") return base + "bg-sky-100 text-sky-700";
  if (rec.attendanceStatus === "Half_Day") return base + "bg-indigo-100 text-indigo-700";
  if (rec.attendanceStatus === "Absent") return base + "bg-red-100 text-red-700";
  return base + "bg-gray-100 text-gray-600";
}

export default function AttendanceCalendar({ records = [], prefix, onPrevMonth, onNextMonth, isCurrentMonth }) {
  const { daysInMonth } = getMonthRange(prefix);
  const today = new Date().toISOString().split("T")[0];
  const firstDow = new Date(`${prefix}-01`).getDay();

  // Build date → record lookup
  const recMap = {};
  records.forEach((r) => {
    const key = new Date(r.date).toISOString().split("T")[0];
    recMap[key] = r;
  });

  // Build grid cells — pad front, pad tail to fill last row
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, ds: `${prefix}-${String(d).padStart(2, "0")}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // Summary stats
  const approvedPresent = records.filter((r) => r.submissionStatus === "Approved" && r.attendanceStatus === "Present").length;
  const approvedHalf = records.filter((r) => r.submissionStatus === "Approved" && r.attendanceStatus === "Half_Day").length;
  const pendingCount = records.filter((r) => r.submissionStatus === "Pending").length;
  const pastDayCells = cells.filter((c) => c && c.ds < today);
  const absentCount = pastDayCells.filter((c) => !recMap[c.ds]).length;
  const totalPast = pastDayCells.length;
  const pct = totalPast > 0 ? Math.round(((approvedPresent + approvedHalf * 0.5) / totalPast) * 100) : 0;
  const pctColor = pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)";

  return (
    <div>
      {/* Month navigation header */}
      <div className="flex items-center justify-between mb-2">
        <Button size="sm" variant="ghost" onClick={onPrevMonth}>
          <i className="ti ti-chevron-left text-sm" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-semibold">{formatMonth(prefix)}</div>
          <div className="text-xs text-muted mt-0.5 flex flex-wrap justify-center gap-x-2">
            <span className="text-success font-medium">{approvedPresent}P</span>
            {approvedHalf > 0 && <span className="text-indigo-600 font-medium">{approvedHalf}H</span>}
            <span className="text-danger">{absentCount}A</span>
            {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pending</span>}
            {totalPast > 0 && <span className="font-bold" style={{ color: pctColor }}>{pct}%</span>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onNextMonth} disabled={isCurrentMonth}>
          <i className="ti ti-chevron-right text-sm" />
        </Button>
      </div>

      {/* Attendance % bar */}
      {totalPast > 0 && (
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pctColor }}
          />
        </div>
      )}

      {/* Day-of-week headers */}
      <div className="cal-header">
        {DAY_NAMES.map((d) => (
          <span key={d} className="text-center text-[10px] font-semibold text-muted uppercase">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const { d, ds } = cell;
          const rec = recMap[ds];
          const isPast = ds < today;
          const isToday = ds === today;
          return (
            <div
              key={i}
              className={cellClass(rec, isPast, isToday)}
              title={rec ? `${rec.attendanceStatus} — ${rec.submissionStatus}` : isPast ? "No record" : ""}
            >
              {d}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300 inline-block" />Present
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-100 border border-sky-300 inline-block" />Leave
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300 inline-block" />Half Day
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300 inline-block" />Rejected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-200 inline-block" />Absent
        </span>
      </div>
    </div>
  );
}
