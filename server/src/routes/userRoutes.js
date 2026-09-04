// Express router import kar rahe hain.
import express from "express";

// Storage controller import kar rahe hain.
import { getMyStorage } from "../controllers/userController.js";

// Authentication middleware import kar rahe hain.
import { requireAuthentication } from "../middlewares/authMiddleware.js";

// User router create kar rahe hain.
const userRouter = express.Router();

// GET /api/users/me/storage protected endpoint hai.
userRouter.get("/me/storage", requireAuthentication, getMyStorage);

// Router export kar rahe hain.
export default userRouter;