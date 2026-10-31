import { db } from "../prisma/db.js";

export async function checkDatabaseConnection(): Promise<void> {
  try {
    await db.connect();

    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
}