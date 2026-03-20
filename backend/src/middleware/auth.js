const jwt = require("jsonwebtoken");

// This middleware runs BEFORE protected routes
// It checks if the request has a valid JWT token
const authMiddleware = (req, res, next) => {
  // Token is sent in the Authorization header as: "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Extract token after "Bearer "

  try {
    // jwt.verify checks if the token is valid AND not expired
    // It decodes the payload we stored when we created the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request object
    next(); // Proceed to the actual route handler
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
