import express from "express";
import cors from "cors";
import { checkDatabaseConnection } from "./config/database.config.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "matchpulse-backend",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await checkDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

startServer();