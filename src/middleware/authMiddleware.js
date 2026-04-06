const { verifyToken } = require("../utils/token");

const protect = (req, res, next) => {
  let token = req.headers.authorization;

  if (!token || !token.startsWith("Bearer")) {
    return res.status(401).json({ message: "Unauthorized - No Token" });
  }

  try {
    token = token.split(" ")[1];

    const decoded = verifyToken(token);

    req.user = decoded; // attach user

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};


module.exports = protect;