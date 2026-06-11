import api from "./api";

export const reportService = {
  getPL: (month) => api.get("/reports/pl", { params: { month } }),
  downloadPLCsv: (month) => api.get("/reports/pl/csv", { params: { month }, responseType: "blob" }),
  getSupplier: (params) => api.get("/reports/purchase/supplier", { params }),
  downloadSupplierCsv: () => api.get("/reports/purchase/supplier/csv", { responseType: "blob" }),
  downloadAttendanceCsv: (month) => api.get("/attendance/csv", { params: { month }, responseType: "blob" }),
};
