import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import healthRouter from "./routes/healthRoutes.js";
import authRouter from "./routes/authRoutes.js";
import fileRouter from "./routes/fileRoutes.js";
import userRouter from "./routes/userRoutes.js";

const app = express();

// ES Module __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5001",
  "https://cloud-vault-compression-service.onrender.com",
  "https://cloud-vault-vpax.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman, mobile apps, or curl)
      if (!origin) return callback(null, true);

      // Allow if origin is in explicit list OR is a render subdomain
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.endsWith(".onrender.com")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

// API Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/files", fileRouter);
app.use("/api/users", userRouter);

// API Status Route
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Digital Asset API is running",
  });
});

// Production Mode: Static React Serve
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  // Express 5 Safe Middleware Catch-All (No regex path error)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({
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

// CRITICAL: Export default lagana zaruri hai
export default app;
