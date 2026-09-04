import express from "express";
import cors from "cors";
import env from "./config/env.js";
import healthRouter from "./routes/healthRoutes.js";
// ye import authentication routes ko main Express application mein available karega.
// Import authentication routes.
import authRouter from "./routes/authRoutes.js";

// File routes import kar rahe hain.
import fileRouter from "./routes/fileRoutes.js";

// User routes import kar rahe hain.
import userRouter from "./routes/userRoutes.js";

const app = express();

// Middlewares setup
app.use(
  cors({
    origin: env.clientUrl,
  })
);

app.use(express.json());

// ye code health aur authentication dono route groups ko Express application mein attach karta hai.
// Register the health route.
app.use("/api/health", healthRouter);

// is line ke baad /api/auth/register request authRouter ke paas jayegi.
// Register authentication endpoints.
app.use("/api/auth", authRouter);

// Protected file endpoints register kar rahe hain.
app.use("/api/files", fileRouter);

// Protected user endpoints register kar rahe hain.
app.use("/api/users", userRouter);

// Add a response for the backend root URL.
app.get("/", (request, response) => {
  response.status(200).json({
    success: true,
    message: "Digital Asset API is running",
  });
});

// 404 Handler - Unhandled routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;