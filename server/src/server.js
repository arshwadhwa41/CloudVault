import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import env from "./config/env.js";
import connectDatabase from "./config/db.js";

async function startServer() {
  try {
    await connectDatabase();

    app.listen(env.port || 5000, () => {
      console.log(`Server running on http://localhost:${env.port || 5000}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();