// Generic role-based middleware
const authorizeRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

const isAdmin = (req, res, next) => {

  console.log("req.user",req.user);
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  next();
};

module.exports = {
  authorizeRole,
  isAdmin,
};
