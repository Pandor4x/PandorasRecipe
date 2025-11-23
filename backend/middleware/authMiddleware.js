const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "yourSecretKey";

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('verifyAdmin auth header:', authHeader);
  const token = authHeader?.split(" ")[1];
  if (!token) {
    console.warn('verifyAdmin: no token provided');
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.is_admin) return res.status(403).json({ error: "Admin only" });
    req.user = decoded;
    next();
  } catch (err) {
    console.warn('verifyAdmin: token invalid', err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

// Generic auth verifier - sets req.user when token is valid
const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token) {
    console.warn('verifyAuth: no token provided');
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn('verifyAuth: token invalid', err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = { verifyAdmin, verifyAuth };
