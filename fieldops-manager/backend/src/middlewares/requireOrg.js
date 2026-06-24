const prisma = require("../config/db");
const { error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

// Super_Admin has global access (orgId = null by design).
// All other roles must belong to an organisation before they can access any resource.
//
// This also re-verifies live DB state on every request (not just at login/refresh),
// so a stale JWT cannot keep operating after the user is deactivated, the user's
// organisation is reassigned, or the organisation itself is deactivated mid-session.
const requireOrg = asyncHandler(async (req, res, next) => {
  if (req.user.role === "Super_Admin") {
    const su = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isActive: true } });
    if (!su || !su.isActive) return error(res, "Account is no longer active. Please log in again.", 401);
    return next();
  }

  if (!req.user.orgId) return error(res, "Account not assigned to an organisation. Contact your Super Admin.", 403);

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isActive: true, orgId: true, org: { select: { isActive: true } } },
  });

  if (!user || !user.isActive) return error(res, "Account is no longer active. Please log in again.", 401);
  if (user.orgId !== req.user.orgId) return error(res, "Your organisation assignment has changed. Please log in again.", 401);
  if (!user.org || !user.org.isActive) return error(res, "Your organisation has been deactivated. Contact your administrator.", 403);

  next();
});

module.exports = requireOrg;
