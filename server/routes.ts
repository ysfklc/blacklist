import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { authenticateToken, requireRole, hashPassword } from "./auth";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertDataSourceSchema, insertIndicatorSchema, insertWhitelistSchema } from "@shared/schema";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fetchAndParseData } from "./fetcher";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, authType } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check auth type
      if (user.authType !== authType) {
        return res.status(401).json({ error: "Invalid authentication type" });
      }

      // For LDAP users, we would normally authenticate against LDAP server
      // For now, we'll use local password validation
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // Create JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Log successful login
      await storage.createAuditLog({
        level: "info",
        action: "login",
        resource: "authentication",
        details: `Successful login via ${authType} authentication`,
        userId: user.id,
        ipAddress: req.ip,
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          authType: user.authType,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      await storage.createAuditLog({
        level: "info",
        action: "logout",
        resource: "authentication",
        details: "User logged out",
        userId: req.user.userId,
        ipAddress: req.ip,
      });
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        authType: user.authType,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User management routes
  app.get("/api/users", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        authType: user.authType,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Hash password only for local auth users
      let hashedPassword = null;
      if (validatedData.authType === "local" && validatedData.password) {
        hashedPassword = await hashPassword(validatedData.password);
      }
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "user",
        resourceId: user.id.toString(),
        details: `Created new user: ${user.username}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        authType: user.authType,
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/users/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(id, updateData);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "user",
        resourceId: id.toString(),
        details: `Updated user: ${user.username}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        authType: user.authType,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (id === req.user.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "user",
        resourceId: id.toString(),
        details: `Deleted user`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "User deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Routes for non-admin users to manage their own profile
  app.get("/api/users/profile", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        authType: user.authType,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/users/profile/password", authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update password
      await storage.updateUserPassword(req.user.userId, hashedPassword);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "user",
        resourceId: req.user.userId.toString(),
        details: "Password updated",
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // LDAP lookup route
  app.get("/api/ldap/search", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      // Mock LDAP search results for demonstration
      // In a real implementation, you would connect to your LDAP server here
      const mockResults = [
        {
          username: `${query}.doe`,
          firstName: "John",
          lastName: "Doe",
          email: `${query}.doe@company.com`,
          cn: `${query} Doe`,
        },
        {
          username: `${query}.smith`,
          firstName: "Jane",
          lastName: "Smith", 
          email: `${query}.smith@company.com`,
          cn: `${query} Smith`,
        }
      ].filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.firstName.toLowerCase().includes(query.toLowerCase()) ||
        user.lastName.toLowerCase().includes(query.toLowerCase())
      );

      res.json(mockResults);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Data sources routes
  app.get("/api/data-sources", authenticateToken, async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/data-sources", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertDataSourceSchema.parse({
        ...req.body,
        createdBy: req.user.userId,
      });
      
      const dataSource = await storage.createDataSource(validatedData);
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "data_source",
        resourceId: dataSource.id.toString(),
        details: `Created new data source: ${dataSource.name}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.status(201).json(dataSource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/data-sources/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dataSource = await storage.updateDataSource(id, req.body);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "data_source",
        resourceId: id.toString(),
        details: `Updated data source: ${dataSource.name}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json(dataSource);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/data-sources/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataSource(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "data_source",
        resourceId: id.toString(),
        details: `Deleted data source`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Data source deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pause data source endpoint
  app.post("/api/data-sources/:id/pause", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      await storage.pauseDataSource(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "pause",
        resource: "data_source",
        resourceId: id.toString(),
        details: `Paused data source`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Data source paused successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resume data source endpoint
  app.post("/api/data-sources/:id/resume", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      await storage.resumeDataSource(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "resume",
        resource: "data_source",
        resourceId: id.toString(),
        details: `Resumed data source`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Data source resumed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual fetch endpoint
  app.post("/api/data-sources/:id/fetch", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the data source
      const dataSources = await storage.getDataSources();
      const dataSource = dataSources.find(ds => ds.id === id);
      
      if (!dataSource) {
        return res.status(404).json({ error: "Data source not found" });
      }

      if (!dataSource.isActive) {
        return res.status(400).json({ error: "Data source is not active" });
      }

      if (dataSource.isPaused) {
        return res.status(400).json({ error: "Data source is paused" });
      }

      // Log the manual fetch trigger
      await storage.createAuditLog({
        level: "info",
        action: "manual_fetch",
        resource: "data_source",
        resourceId: id.toString(),
        details: `Manual fetch triggered for data source: ${dataSource.name}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      // Trigger the fetch (don't await - run in background)
      fetchAndParseData(dataSource).catch(error => {
        console.error(`[MANUAL_FETCH] Error in background fetch for ${dataSource.name}:`, error);
      });

      res.json({ message: "Fetch started successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Indicators routes
  app.get("/api/indicators", authenticateToken, async (req, res) => {
    try {
      const { page = 1, limit = 50, type, status, source, search } = req.query;
      const filters = {
        type: type as string,
        status: status as string,
        source: source as string,
        search: search as string,
      };
      const indicators = await storage.getIndicators(
        parseInt(page as string),
        parseInt(limit as string),
        filters
      );
      res.json(indicators);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/indicators/sources", authenticateToken, async (req, res) => {
    try {
      const sources = await storage.getDistinctIndicatorSources();
      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/indicators", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const validatedData = insertIndicatorSchema.parse({
        ...req.body,
        createdBy: req.user.userId,
      });

      // Check if indicator is whitelisted
      const isWhitelisted = await storage.isWhitelisted(validatedData.value, validatedData.type);
      if (isWhitelisted) {
        await storage.createAuditLog({
          level: "warning",
          action: "blocked",
          resource: "indicator",
          details: `Whitelist blocked indicator: ${validatedData.value}`,
          userId: req.user.userId,
          ipAddress: req.ip,
        });
        return res.status(400).json({ error: "Indicator is whitelisted" });
      }
      
      const indicator = await storage.createIndicator(validatedData);
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "indicator",
        resourceId: indicator.id.toString(),
        details: `Created new indicator: ${indicator.value}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.status(201).json(indicator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/indicators/:id", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const indicator = await storage.updateIndicator(id, req.body);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "indicator",
        resourceId: id.toString(),
        details: `Updated indicator: ${indicator.value}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json(indicator);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/indicators/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteIndicator(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "indicator",
        resourceId: id.toString(),
        details: `Deleted indicator`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Indicator deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Whitelist routes
  app.get("/api/whitelist", authenticateToken, async (req, res) => {
    try {
      const whitelist = await storage.getWhitelist();
      res.json(whitelist);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/whitelist", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const validatedData = insertWhitelistSchema.parse({
        ...req.body,
        createdBy: req.user.userId,
      });
      
      const entry = await storage.createWhitelistEntry(validatedData);
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "whitelist",
        resourceId: entry.id.toString(),
        details: `Added to whitelist: ${entry.value}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/whitelist/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWhitelistEntry(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "whitelist",
        resourceId: id.toString(),
        details: `Removed from whitelist`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Whitelist entry deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audit logs routes
  app.get("/api/audit-logs", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const { page = 1, limit = 50, level, action, user, startDate, endDate } = req.query;
      const filters = {
        level: level as string,
        action: action as string,
        user: user as string,
        startDate: startDate as string,
        endDate: endDate as string,
      };
      const logs = await storage.getAuditLogs(
        parseInt(page as string),
        parseInt(limit as string),
        filters
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/audit-logs/export", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const { level, action, user, startDate, endDate } = req.query;
      const filters = {
        level: level as string,
        action: action as string,
        user: user as string,
        startDate: startDate as string,
        endDate: endDate as string,
      };
      
      // Get all logs matching filters (no pagination for export)
      const result = await storage.getAuditLogs(1, 100000, filters);
      
      // Convert to CSV
      const headers = ["Timestamp", "Level", "User", "Action", "Resource", "Details", "IP Address"];
      const csvData = [
        headers.join(","),
        ...result.data.map((log: any) => [
          log.createdAt,
          log.level,
          log.user || "System",
          log.action,
          log.resource,
          `"${log.details.replace(/"/g, '""')}"`,
          log.ipAddress || ""
        ].join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Settings routes
  app.get("/api/settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      await storage.updateSettings(req.body, req.user.userId);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "settings",
        details: "Updated system settings",
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Settings updated" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/test-ldap", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      // This would normally test LDAP connection
      // For now, we'll simulate a successful test
      const { server, port, baseDN, bindDN } = req.body;
      
      if (!server || !port || !baseDN || !bindDN) {
        return res.status(400).json({ error: "Missing required LDAP configuration" });
      }
      
      await storage.createAuditLog({
        level: "info",
        action: "test",
        resource: "ldap",
        details: `LDAP connection test to ${server}:${port}`,
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "LDAP connection test successful" });
    } catch (error) {
      res.status(500).json({ error: "LDAP connection test failed" });
    }
  });

  // Public blacklist files
  app.use("/public/blacklist", express.static(path.join(process.cwd(), "public/blacklist")));

  app.get("/api/public-links/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getPublicFileStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/blacklist/refresh", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      // This would trigger blacklist regeneration
      const { generateBlacklistFiles } = await import("./blacklistGenerator");
      await generateBlacklistFiles();
      
      await storage.createAuditLog({
        level: "info",
        action: "refresh",
        resource: "blacklist",
        details: "Manually triggered blacklist refresh",
        userId: req.user.userId,
        ipAddress: req.ip,
      });

      res.json({ message: "Blacklist refresh initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh blacklist" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
