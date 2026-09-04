import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import User from "../models/User.js";
import { createToken } from "../utils/jwt.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../services/emailService.js";

// =========================================================
// GOOGLE CLIENT
// =========================================================

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// =========================================================
// HELPERS
// =========================================================

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Strong Password Regex:
// At least:
// - 8 characters
// - 1 lowercase
// - 1 uppercase
// - 1 number
// - 1 special character
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;


// =========================================================
// REGISTER USER
// =========================================================

export async function registerUser(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // -----------------------------
    // Clean input
    // -----------------------------

    const cleanedName =
      typeof name === "string"
        ? name.trim()
        : "";

    const cleanedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    // -----------------------------
    // Validate name
    // -----------------------------

    if (
      cleanedName.length < 2 ||
      cleanedName.length > 80
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be between 2 and 80 Characters",
        errorCode: "INVALID_NAME",
      });
    }

    // -----------------------------
    // Validate email
    // -----------------------------

    if (!isValidEmail(cleanedEmail)) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid email address",
        errorCode: "INVALID_EMAIL",
      });
    }

    // -----------------------------
    // Validate password
    // -----------------------------

    if (
      typeof password !== "string" ||
      !passwordRegex.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and include at least one uppercase letter, one number, and one special character (@$!%*?&#).",
        errorCode: "INVALID_PASSWORD",
      });
    }

    // -----------------------------
    // Check existing user
    // -----------------------------

    const existingUser = await User.findOne({
      email: cleanedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists",
        errorCode: "EMAIL_ALREADY_EXISTS",
      });
    }

    // -----------------------------
    // Hash password
    // -----------------------------

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // -----------------------------
    // Generate verification token
    // -----------------------------

    const verificationToken = crypto
      .randomBytes(32)
      .toString("hex");

    // -----------------------------
    // Create user
    // -----------------------------

    const user = await User.create({
      name: cleanedName,
      email: cleanedEmail,
      passwordHash,

      isVerified: false,
      verificationToken,
    });

    // -----------------------------
    // Send verification email
    // -----------------------------

    await sendVerificationEmail(
      user.email,
      verificationToken
    );

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(201).json({
      success: true,
      message:
        "Registration successful! Please check your email to verify your account.",
    });
  } catch (error) {
    next(error);
  }
}


// =========================================================
// LOGIN USER
// =========================================================

export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    const cleanedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    // -----------------------------
    // Validate fields
    // -----------------------------

    if (
      !cleanedEmail ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
        errorCode: "MISSING_LOGIN_FIELDS",
      });
    }

    // -----------------------------
    // Find user
    // passwordHash is select:false
    // so explicitly select it
    // -----------------------------

    const user = await User.findOne({
      email: cleanedEmail,
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
        errorCode: "INVALID_CREDENTIALS",
      });
    }

    // -----------------------------
    // Google-only account check
    // -----------------------------

    if (!user.passwordHash && user.googleId) {
      return res.status(400).json({
        success: false,
        message:
          "This account was created with Google. Please continue with Google.",
        errorCode: "GOOGLE_ACCOUNT",
      });
    }

    // -----------------------------
    // Check email verification
    // -----------------------------

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Your email is not verified yet. Please check your inbox.",
        errorCode: "EMAIL_NOT_VERIFIED",
      });
    }

    // -----------------------------
    // Compare password
    // -----------------------------

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
        errorCode: "INVALID_CREDENTIALS",
      });
    }

    // -----------------------------
    // Create JWT
    // -----------------------------

    const token = createToken(user._id);

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(200).json({
      success: true,
      data: {
        token,

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          storageQuota: user.storageQuota,
          storageUsed: Math.max(0, user.storageUsed || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}


// =========================================================
// GOOGLE AUTHENTICATION
// =========================================================

export async function googleAuth(req, res, next) {
  try {
    const { token } = req.body;

    // -----------------------------
    // Validate Google token
    // -----------------------------

    if (!token) {
      return res.status(400).json({
        success: false,
        message:
          "Google token is required.",
        errorCode: "MISSING_GOOGLE_TOKEN",
      });
    }

    // -----------------------------
    // Verify token with Google
    // -----------------------------

    const ticket =
      await googleClient.verifyIdToken({
        idToken: token,
        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    const payload =
      ticket.getPayload();

    if (!payload) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Google token.",
        errorCode: "INVALID_GOOGLE_TOKEN",
      });
    }

    const {
      sub: googleId,
      email,
      name,
      picture,
      email_verified: googleEmailVerified,
    } = payload;

    // -----------------------------
    // Validate Google payload
    // -----------------------------

    if (
      !googleId ||
      !email
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Google account information is incomplete.",
        errorCode: "INCOMPLETE_GOOGLE_ACCOUNT",
      });
    }

    if (!googleEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Your Google email address is not verified.",
        errorCode: "GOOGLE_EMAIL_NOT_VERIFIED",
      });
    }

    const cleanedEmail =
      email.trim().toLowerCase();

    // -----------------------------
    // Find existing user
    // -----------------------------

    let user = await User.findOne({
      $or: [
        { googleId },
        { email: cleanedEmail },
      ],
    });

    // =====================================================
    // EXISTING USER
    // =====================================================

    if (user) {
      // ---------------------------------
      // Existing email/password account
      // Link Google account
      // ---------------------------------

      if (!user.googleId) {
        user.googleId = googleId;
      }

      // Google has verified this email
      user.isVerified = true;

      // Add Google profile picture if
      // user doesn't already have one
      if (
        picture &&
        !user.profile?.avatarUrl
      ) {
        if (!user.profile) user.profile = {};
        user.profile.avatarUrl = picture;
      }

      // FIX: Ensure storageUsed is non-negative before validation/saving
      if (typeof user.storageUsed !== "number" || user.storageUsed < 0) {
        user.storageUsed = 0;
      }

      await user.save();
    }

    // =====================================================
    // NEW GOOGLE USER
    // =====================================================

    else {
      user = await User.create({
        name:
          typeof name === "string" &&
          name.trim()
            ? name.trim()
            : "Google User",

        email: cleanedEmail,

        // No passwordHash for Google-only account
        googleId,

        // Google email is already verified
        isVerified: true,

        verificationToken: null,

        storageUsed: 0,

        profile: {
          avatarUrl: picture || "",
          bio: "",
        },
      });
    }

    // -----------------------------
    // Create application JWT
    // -----------------------------

    const appToken =
      createToken(user._id);

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(200).json({
      success: true,
      message:
        "Google login successful!",
      data: {
        token: appToken,

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          storageQuota:
            user.storageQuota,
          storageUsed:
            Math.max(0, user.storageUsed || 0),
        },
      },
    });
  } catch (error) {
    console.error(
      "Google auth error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        "Invalid Google token or verification failed.",
      errorCode: "GOOGLE_AUTH_FAILED",
    });
  }
}


// =========================================================
// VERIFY EMAIL
// =========================================================

export async function verifyEmail(
  req,
  res,
  next
) {
  try {
    const { token } = req.query;

    // -----------------------------
    // Validate token
    // -----------------------------

    if (
      !token ||
      typeof token !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Verification token is required.",
        errorCode:
          "MISSING_VERIFICATION_TOKEN",
      });
    }

    // -----------------------------
    // Find user
    // -----------------------------

    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired verification token.",
        errorCode:
          "INVALID_VERIFICATION_TOKEN",
      });
    }

    // -----------------------------
    // Verify email
    // -----------------------------

    user.isVerified = true;
    user.verificationToken = null;

    if (typeof user.storageUsed !== "number" || user.storageUsed < 0) {
      user.storageUsed = 0;
    }

    await user.save();

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(200).json({
      success: true,
      message:
        "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    next(error);
  }
}


// =========================================================
// GET CURRENT USER
// =========================================================

export async function getCurrentUser(
  req,
  res,
  next
) {
  try {
    const user =
      await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User account not found",
        errorCode:
          "USER_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          storageQuota:
            user.storageQuota,
          storageUsed:
            Math.max(0, user.storageUsed || 0),
          createdAt:
            user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}


// =========================================================
// FORGOT PASSWORD
// =========================================================

export async function forgotPassword(
  req,
  res,
  next
) {
  try {
    const { email } = req.body;

    const cleanedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    // -----------------------------
    // Basic validation
    // -----------------------------

    if (!isValidEmail(cleanedEmail)) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid email address.",
        errorCode:
          "INVALID_EMAIL",
      });
    }

    // -----------------------------
    // Find user
    // -----------------------------

    const user =
      await User.findOne({
        email: cleanedEmail,
      });

    // -----------------------------
    // Generic response
    // Prevent email enumeration
    // -----------------------------

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If that email is registered, we have sent a reset link to it.",
      });
    }

    // -----------------------------
    // Generate reset token
    // -----------------------------

    const resetToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    // -----------------------------
    // Save reset token + expiry
    // -----------------------------

    user.resetPasswordToken =
      resetToken;

    user.resetPasswordExpires =
      new Date(
        Date.now() +
          15 * 60 * 1000
      );

    if (typeof user.storageUsed !== "number" || user.storageUsed < 0) {
      user.storageUsed = 0;
    }

    await user.save();

    // -----------------------------
    // Send reset email
    // -----------------------------

    await sendResetPasswordEmail(
      user.email,
      resetToken
    );

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(200).json({
      success: true,
      message:
        "If that email is registered, we have sent a reset link to it.",
    });
  } catch (error) {
    next(error);
  }
}


// =========================================================
// RESET PASSWORD
// =========================================================

export async function resetPassword(
  req,
  res,
  next
) {
  try {
    const {
      token,
      newPassword,
    } = req.body;

    // -----------------------------
    // Validate token
    // -----------------------------

    if (
      !token ||
      typeof token !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token is required.",
        errorCode:
          "MISSING_RESET_TOKEN",
      });
    }

    // -----------------------------
    // Validate password
    // -----------------------------

    if (
      typeof newPassword !== "string" ||
      !passwordRegex.test(newPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long, contain 1 uppercase, 1 number, and 1 special character.",
        errorCode:
          "INVALID_PASSWORD",
      });
    }

    // -----------------------------
    // Find valid reset token
    // -----------------------------

    const user =
      await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: {
          $gt: new Date(),
        },
      }).select("+passwordHash");

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired reset token. Please request a new one.",
        errorCode:
          "INVALID_RESET_TOKEN",
      });
    }

    // -----------------------------
    // Hash new password
    // -----------------------------

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    // -----------------------------
    // Update password
    // -----------------------------

    user.passwordHash =
      passwordHash;

    user.resetPasswordToken =
      null;

    user.resetPasswordExpires =
      null;

    if (typeof user.storageUsed !== "number" || user.storageUsed < 0) {
      user.storageUsed = 0;
    }

    await user.save();

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
}