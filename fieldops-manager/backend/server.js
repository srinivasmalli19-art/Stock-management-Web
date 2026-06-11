require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const morgan = require("morgan");

const logger = require("./src/utils/logger");
const errorHandler = require("./src/middlewares/errorHandler");

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const skuRoutes = require("./src/routes/sku.routes");
const productivityRoutes = require("./src/routes/productivity.routes");
const stockRequestRoutes = require("./src/routes/stockRequest.routes");
const revokeRequestRoutes = require("./src/routes/revokeRequest.routes");
const purchaseInwardRoutes = require("./src/routes/purchaseInward.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const inventoryRoutes = require("./src/routes/inventory.routes");
const reportsRoutes = require("./src/routes/reports.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/skus", skuRoutes);
app.use("/api/productivity", productivityRoutes);
app.use("/api/stock-requests", stockRequestRoutes);
app.use("/api/revoke-requests", revokeRequestRoutes);
app.use("/api/purchase-inward", purchaseInwardRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`FieldOps API running on port ${PORT}`));

module.exports = app;
