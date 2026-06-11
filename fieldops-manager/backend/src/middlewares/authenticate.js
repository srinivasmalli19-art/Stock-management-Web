const { verifyAccessToken } = require("../utils/tokenUtils");
const { error } = require("../utils/responseHelper");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(res, "No token provided", 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return error(res, "Token expired", 401);
    }
    return error(res, "Invalid token", 401);
  }
};

module.exports = authenticate;
