import api from "./api";

export const inventoryService = {
  getMain: () => api.get("/inventory/main"),
  getEngineerStock: (id) => api.get(`/inventory/engineer/${id}`),
  getMyStock: () => api.get("/inventory/my-stock"),
  downloadCsv: () => api.get("/inventory/main/csv", { responseType: "blob" }),
};
