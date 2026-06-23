import Card, { CardTitle } from "../common/Card";

const Stat = ({ label, value, icon, color = "accent" }) => {
  const colors = {
    accent:  "text-accent  bg-blue-50",
    green:   "text-success bg-green-50",
    amber:   "text-warn    bg-amber-50",
    purple:  "text-purple-600 bg-purple-50",
    muted:   "text-muted   bg-gray-50",
  };
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-gray-50 border border-border">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color] || colors.accent}`}>
        <i className={`ti ${icon} text-base`} />
      </div>
      <div className="text-2xl font-bold text-text leading-none">{value ?? 0}</div>
      <div className="text-[11px] text-muted leading-tight">{label}</div>
    </div>
  );
};

export default function TodaySummary({ stats = [] }) {
  return (
    <Card>
      <CardTitle>Today&apos;s Summary</CardTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
    </Card>
  );
}
