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
const lpRequestRoutes = require("./src/routes/lpRequest.routes");
const claimRequestRoutes = require("./src/routes/claimRequest.routes");
const organisationRoutes = require("./src/routes/organisation.routes");
const staffAttendanceRoutes = require("./src/routes/staffAttendance.routes");
const attendanceLedgerRoutes = require("./src/routes/attendanceLedger.routes");

const app = express();

app.use(helmet());

// Known production origins — always allowed regardless of env vars
const PRODUCTION_ORIGINS = ["https://logitask.in", "https://www.logitask.in"];

// Build allowed origins: hardcoded production + localhost dev + FRONTEND_URL env var (comma-separated)
// FRONTEND_URL can hold extra origins: FRONTEND_URL=https://staging.logitask.in
const getAllowedOrigins = () => {
  const devOrigins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"];
  const envOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...PRODUCTION_ORIGINS, ...devOrigins, ...envOrigins];
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin} | allowed: ${allowed.join(", ")}`);
      callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
logger.info(`CORS allowed origins: ${getAllowedOrigins().join(", ")}`);

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
app.use("/api/lp-requests", lpRequestRoutes);
app.use("/api/claim-requests", claimRequestRoutes);
app.use("/api/organisations", organisationRoutes);
app.use("/api/staff-attendance", staffAttendanceRoutes);
app.use("/api/attendance-ledger", attendanceLedgerRoutes);

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    corsOrigins: getAllowedOrigins(),
  })
);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`FieldOps API running on port ${PORT}`));

module.exports = app;
