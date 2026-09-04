import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC USER INFORMATION
    // =====================================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // =====================================================
    // PASSWORD AUTHENTICATION
    // =====================================================

    passwordHash: {
      type: String,
      required: function () {
        // Password is required only for normal accounts.
        // Google accounts can authenticate using googleId.
        return !this.googleId;
      },
      select: false,
    },

    // =====================================================
    // GOOGLE AUTHENTICATION
    // =====================================================

    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },

    // =====================================================
    // EMAIL VERIFICATION
    // =====================================================

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    // =====================================================
    // PASSWORD RESET
    // =====================================================

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // =====================================================
    // STORAGE
    // =====================================================

    storageQuota: {
      type: Number,
      required: true,
      default: 500 * 1024 * 1024, // 500 MB
      min: 0,
    },

    storageUsed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // =====================================================
    // PROFILE
    // =====================================================

    profile: {
      avatarUrl: {
        type: String,
        default: "",
      },

      bio: {
        type: String,
        default: "",
        maxlength: 500,
      },
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
