import { useState } from "react";
import { getCurrentMonthPrefix } from "../utils/formatters";

export function useMonthSelector(initialOffset = 0) {
  const now = new Date();
  const getPrefix = (offset = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getPrefix(initialOffset));

  const months = [-2, -1, 0].map((offset) => {
    const prefix = getPrefix(offset);
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return {
      prefix,
      label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      fullLabel: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  });

  return { selectedMonth, setSelectedMonth, months };
}
