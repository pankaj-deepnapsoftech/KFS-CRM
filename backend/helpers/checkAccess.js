const { TryCatch } = require("./error");

const checkAccess = TryCatch(async (req, res, next) => {
  const route = req.originalUrl.split("/")[2];
  
  if (req.user.role === 'Super Admin' || req.user.allowedroutes.includes(route)) {
    next();
  } else {
    res.status(401).json({
      status: 401,
      success: false,
      message: `You don't have access to ${route} route.`,
    });
  }
});

module.exports = { checkAccess };
