import express from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";
import { requireAuthentication } from "../middlewares/authMiddleware.js";
import { googleAuth } from "../controllers/authController.js";

const authRouter = express.Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.get("/me", requireAuthentication, getCurrentUser);
authRouter.get("/verify-email", verifyEmail);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.post("/google", googleAuth);

export default authRouter;