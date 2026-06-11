const { error } = require("../utils/responseHelper");

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return error(res, "Not authenticated", 401);
  if (!roles.includes(req.user.role)) {
    return error(res, "Insufficient permissions", 403);
  }
  next();
};

module.exports = authorize;
