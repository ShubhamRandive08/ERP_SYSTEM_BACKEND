const jwt = require("jsonwebtoken");

const SECRET = "MY_SECRET_KEY";

// ✅ Generate Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    SECRET,
    { expiresIn: "1d" }
  );
};

// ✅ Verify Token
const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};

module.exports = { generateToken, verifyToken };