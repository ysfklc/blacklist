import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

export async function initializeDatabase(): Promise<void> {
  try {
    console.log("Initializing database...");
    
    // Check if admin user exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (existingAdmin.length === 0) {
      console.log("Creating initial admin user...");
      
      // Create admin user with default password
      const hashedPassword = await hashPassword("test123");
      
      await db.insert(users).values({
        username: "admin",
        password: hashedPassword,
        role: "admin",
        authType: "local",
        isActive: true,
      });
      
      console.log("Admin user created successfully (username: admin, password: test123)");
    } else {
      console.log("Admin user already exists");
    }

    // Ensure public blacklist directories exist
    const blacklistDir = path.join(process.cwd(), "public", "blacklist");
    const dirs = ["IP", "Domain", "Hash", "URL"];
    
    for (const dir of dirs) {
      const dirPath = path.join(blacklistDir, dir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        // Directory might already exist, which is fine
      }
    }
    
    console.log("Public blacklist directories initialized");
    console.log("Database initialization complete");
    
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
