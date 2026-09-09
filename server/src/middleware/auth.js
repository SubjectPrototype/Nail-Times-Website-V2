const jwt = require("jsonwebtoken");

function readToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const payload = readToken(req);
  const isAdmin = payload?.role === "admin" || (!payload?.role && payload?.email);
  if (!isAdmin) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.admin = payload;
  return next();
}

function requireGiftCardAccess(req, res, next) {
  const payload = readToken(req);
  const hasAccess = payload?.role === "giftcard-worker"
    || payload?.role === "admin"
    || (!payload?.role && payload?.email);
  if (!hasAccess) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.admin = payload;
  return next();
}

module.exports = { requireAdmin, requireGiftCardAccess };
