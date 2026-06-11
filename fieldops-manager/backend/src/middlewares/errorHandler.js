const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message}`, { stack: err.stack, path: req.path, method: req.method });

  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "Duplicate record — resource already exists" });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found" });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
