const { error } = require("../utils/responseHelper");

// Super_Admin has global access (orgId = null by design).
// All other roles must belong to an organisation before they can access any resource.
const requireOrg = (req, res, next) => {
  if (req.user.role === "Super_Admin") return next();
  if (!req.user.orgId) return error(res, "Account not assigned to an organisation. Contact your Super Admin.", 403);
  next();
};

module.exports = requireOrg;
