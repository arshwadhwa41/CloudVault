import { verifyToken } from "../utils/jwt.js";

export function requireAuthentication(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
        errorCode: "AUTH_TOKEN_REQUIRED",
      });
    }

    const token = authorizationHeader.substring("Bearer ".length);
    const decodedToken = verifyToken(token);
    
    // JWT Payload extraction
    const userId = decodedToken.sub || decodedToken.id || decodedToken.userId || decodedToken._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
        errorCode: "INVALID_AUTH_TOKEN",
      });
    }

    // Both properties attach kar lo standard practice ke liye
    req.userId = userId;
    req.user = { _id: userId, ...decodedToken };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
      errorCode: "INVALID_AUTH_TOKEN",
    });
  }
}