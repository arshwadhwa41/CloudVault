// User model import kar rahe hain.
import User from "../models/User.js";

// Current user ki storage summary return karna.
export async function getMyStorage(request, response, next) {
  try {
    // Middleware se authenticated user ID mil rahi hai.
    const user = await User.findById(request.userId).select(
      "storageQuota storageUsed",
    );

    // Agar user delete ho chuka hai to safe error response do.
    if (!user) {
      return response.status(404).json({
        success: false,
        message: "User account not found",
        errorCode: "USER_NOT_FOUND",
      });
    }

    // Storage values bytes mein return kar rahe hain.
    return response.status(200).json({
      success: true,
      data: {
        storageQuota: user.storageQuota,
        storageUsed: user.storageUsed,
        storageRemaining: Math.max(
          user.storageQuota - user.storageUsed,
          0,
        ),
      },
    });
  } catch (error) {
    // Unexpected error centralized error handler ko bhej rahe hain.
    next(error);
  }
}