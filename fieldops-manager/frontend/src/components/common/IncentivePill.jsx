import { formatCurrency } from "../../utils/formatters";

export default function IncentivePill({ amount }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-semibold">
      <i className="ti ti-star text-xs" />
      {formatCurrency(amount)}
    </span>
  );
}
