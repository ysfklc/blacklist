import { db } from "./db";
import { users, settings } from "@shared/schema";
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
    const dirs = ["IP", "Domain", "Hash", "URL", "Proxy"];
    
    for (const dir of dirs) {
      const dirPath = path.join(blacklistDir, dir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        // Directory might already exist, which is fine
      }
    }
    
    console.log("Public blacklist directories initialized");
    
    // Initialize proxy format settings if they don't exist
    const proxyFormatSettings = [
      { key: "proxyFormat.domainCategory", value: "blocked_domains" },
      { key: "proxyFormat.urlCategory", value: "blocked_urls" }
    ];
    
    // Initialize SOAR-URL setting if it doesn't exist
    const soarUrlSetting = [
      { key: "system.enableSoarUrl", value: "false" }
    ];

    for (const setting of proxyFormatSettings) {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, setting.key))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value,
          encrypted: false,
        });
      }
    }
    
        // Initialize SOAR-URL setting
    for (const setting of soarUrlSetting) {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, setting.key))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value,
          encrypted: false,
        });
      }
    }
    
    console.log("Proxy format and SOAR-URL settings initialized");
    console.log("Database initialization complete");
    
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
