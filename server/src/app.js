import express from "express";
import cors from "cors";
import path from "path";
import env from "./config/env.js";
import healthRouter from "./routes/healthRoutes.js";
import authRouter from "./routes/authRoutes.js";
import fileRouter from "./routes/fileRoutes.js";
import userRouter from "./routes/userRoutes.js";
import { fileURLToPath } from "url";
const app = express();

// ES Module mein __dirname setup
const __dirname = path.resolve();

// Middlewares setup
app.use(
  cors({
    origin: env.clientUrl || "*",
  })
);

app.use(express.json());

// API Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/files", fileRouter);
app.use("/api/users", userRouter);

// API Status Route
app.get("/api", (request, response) => {
  response.status(200).json({
    success: true,
    message: "Digital Asset API is running",
  });
});

// Production Mode: Static React Serve
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  // Express 5 Compatible Catch-All Route (RegExp literal use karke)
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(__dirname, "../client", "dist", "index.html"));
  });
} else {
  app.get("/", (request, response) => {
    response.status(200).json({
      success: true,
      message: "Digital Asset API is running in Development Mode",
    });
  });
}

// 404 Handler for Unhandled API Routes
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