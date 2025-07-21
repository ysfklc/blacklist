import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { authenticateToken, requireRole, hashPassword, authenticateTokenOrApiKey, type AuthRequest } from "./auth";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertDataSourceSchema, insertIndicatorSchema, insertWhitelistSchema, insertIndicatorNoteSchema } from "@shared/schema";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fetchAndParseData } from "./fetcher";
import CIDR from "ip-cidr";
import { ldapService } from "./ldap";
import { getClientIP } from "./utils";

// Enhanced indicator type detection patterns
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const HASH_REGEX = /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{56}$|^[a-fA-F0-9]{64}$|^[a-fA-F0-9]{96}$|^[a-fA-F0-9]{128}$/;
const URL_REGEX = /^https?:\/\/(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|localhost)(?::\d{1,5})?(?:\/[^\s<>"{}|\\^`[\]]*)?$/;

// Additional validation patterns
const RESERVED_IP_RANGES = [
  /^0\./, // Current network
  /^10\./, // Private class A
  /^127\./, // Loopback
  /^169\.254\./, // Link-local
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private class B
  /^192\.168\./, // Private class C
  /^224\./, // Multicast
  /^240\./, // Reserved
];

const INVALID_DOMAINS = [
  /^localhost$/i,
  /\.localhost$/i,
  /^.*\.local$/i,
  /^.*\.internal$/i,
  /^.*\.test$/i,
  /^.*\.example$/i,
  /^.*\.invalid$/i,
];

const INVALID_URLS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\.0\.0\.1/i,
  /^https?:\/\/10\./i,
  /^https?:\/\/192\.168\./i,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./i,
];

function detectWhitelistType(value: string): { type: string; hashType?: string; error?: string } | null {
  if (!value || typeof value !== 'string') {
    return { type: 'error', error: 'Value is required and must be a string' };
  }
  
  const trimmedValue = value.trim();
  
  // Basic format validation
  if (trimmedValue.length === 0) {
    return { type: 'error', error: 'Value cannot be empty' };
  }
  
  if (trimmedValue.length > 65535) {
    return { type: 'error', error: 'Value is too long (maximum 65535 characters)' };
  }
  
  // IP address check (including CIDR notation for whitelist)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
  if (ipRegex.test(trimmedValue)) {
    // Extract IP part for validation (remove CIDR if present)
    const ipPart = trimmedValue.split('/')[0];
    
    // Check for invalid IP addresses
    if (ipPart === '0.0.0.0' || ipPart === '255.255.255.255') {
      return { type: 'error', error: `IP address ${ipPart} is not a valid IP address` };
    }
    
    // For whitelist, we allow private/reserved IPs as they might be legitimate internal assets
    // but we still validate the format
    if (trimmedValue.includes('/')) {
      try {
        new CIDR(trimmedValue);
      } catch (error) {
        return { type: 'error', error: 'Invalid CIDR notation format' };
      }
    }
    
    return { type: 'ip' };
  }
  
  // Domain check with enhanced validation
  if (DOMAIN_REGEX.test(trimmedValue)) {
    // Check for invalid domain patterns
    for (const invalidPattern of INVALID_DOMAINS) {
      if (invalidPattern.test(trimmedValue)) {
        return { type: 'error', error: `Domain ${trimmedValue} uses an invalid or reserved TLD` };
      }
    }
    
    // Additional domain validation
    if (trimmedValue.length > 253) {
      return { type: 'error', error: 'Domain name is too long (maximum 253 characters)' };
    }
    
    // Check for valid TLD
    const parts = trimmedValue.split('.');
    if (parts.length < 2) {
      return { type: 'error', error: 'Domain must have at least one dot and a valid TLD' };
    }
    
    const tld = parts[parts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return { type: 'error', error: 'Domain must have a valid TLD (at least 2 letters)' };
    }
    
    return { type: 'domain' };
  }
  
  // Hash check with validation
  const hashType = detectHashType(trimmedValue);
  if (hashType && hashType !== "unknown") {
    // Validate hash format
    if (!/^[a-fA-F0-9]+$/.test(trimmedValue)) {
      return { type: 'error', error: 'Hash must contain only hexadecimal characters' };
    }
    
    return { type: 'hash', hashType };
  }
  
  // URL check with enhanced validation
  try {
    const url = new URL(trimmedValue);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // Check for invalid URL patterns
      for (const invalidPattern of INVALID_URLS) {
        if (invalidPattern.test(trimmedValue)) {
          return { type: 'error', error: `URL ${trimmedValue} points to a private/reserved address` };
        }
      }
      
      // Additional URL validation
      if (trimmedValue.length > 2048) {
        return { type: 'error', error: 'URL is too long (maximum 2048 characters)' };
      }
      
      return { type: 'url' };
    } else {
      return { type: 'error', error: 'URL must use HTTP or HTTPS protocol' };
    }
  } catch (e) {
    // Not a valid URL, continue to final check
  }
  
  return { type: 'error', error: 'Value does not match any valid pattern (IP, domain, hash, or URL)' };
}

function detectIndicatorType(value: string): { type: string; hashType?: string; error?: string } | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  
  const trimmedValue = value.trim();
  
  // Basic format validation
  if (trimmedValue.length === 0) {
    return null;
  }
  
  if (trimmedValue.length > 2048) {
    return { type: 'error', error: 'Indicator value is too long (maximum 2048 characters)' };
  }
  
  // Check for IP address
  if (IP_REGEX.test(trimmedValue)) {
    // Validate IP is not in reserved ranges
    for (const reservedRange of RESERVED_IP_RANGES) {
      if (reservedRange.test(trimmedValue)) {
        return { type: 'error', error: `IP address ${trimmedValue} is in a reserved/private range and cannot be used as a threat indicator` };
      }
    }
    
    // Check for invalid IP addresses
    if (trimmedValue === '0.0.0.0' || trimmedValue === '255.255.255.255') {
      return { type: 'error', error: `IP address ${trimmedValue} is not a valid threat indicator` };
    }
    
    return { type: 'ip' };
  }
  
  // Check for URL
  if (URL_REGEX.test(trimmedValue)) {
    // Validate URL is not localhost or private
    for (const invalidUrl of INVALID_URLS) {
      if (invalidUrl.test(trimmedValue)) {
        return { type: 'error', error: `URL ${trimmedValue} points to localhost or private network and cannot be used as a threat indicator` };
      }
    }
    
    // Additional URL validation
    try {
      const url = new URL(trimmedValue);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { type: 'error', error: 'URL must use HTTP or HTTPS protocol' };
      }
    } catch (e) {
      return { type: 'error', error: 'Invalid URL format' };
    }
    
    return { type: 'url' };
  }
  
  // Check for hash
  if (HASH_REGEX.test(trimmedValue)) {
    const hashType = detectHashType(trimmedValue);
    if (hashType === 'unknown') {
      return { type: 'error', error: `Hash length ${trimmedValue.length} is not supported. Supported hash types: MD5 (32), SHA1 (40), SHA224 (56), SHA256 (64), SHA384 (96), SHA512 (128)` };
    }
    
    // Validate hash contains only valid hex characters
    if (!/^[a-fA-F0-9]+$/.test(trimmedValue)) {
      return { type: 'error', error: 'Hash must contain only hexadecimal characters (0-9, A-F)' };
    }
    
    return { type: 'hash', hashType };
  }
  
  // Check for domain (must be last as it's most permissive)
  if (DOMAIN_REGEX.test(trimmedValue)) {
    // Validate domain is not localhost or invalid TLD
    for (const invalidDomain of INVALID_DOMAINS) {
      if (invalidDomain.test(trimmedValue)) {
        return { type: 'error', error: `Domain ${trimmedValue} is localhost or uses an invalid TLD and cannot be used as a threat indicator` };
      }
    }
    
    // Check for minimum domain requirements
    if (trimmedValue.length < 4) {
      return { type: 'error', error: 'Domain is too short to be valid' };
    }
    
    // Check for valid domain structure
    const parts = trimmedValue.split('.');
    if (parts.length < 2) {
      return { type: 'error', error: 'Domain must have at least one dot (e.g., example.com)' };
    }
    
    // Check TLD length
    const tld = parts[parts.length - 1];
    if (tld.length < 2 || tld.length > 63) {
      return { type: 'error', error: 'Domain TLD must be between 2 and 63 characters' };
    }
    
    return { type: 'domain' };
  }
  
  return null;
}

function detectHashType(hash: string): string {
  if (!hash) return "unknown";
  
  // Validate hash contains only hexadecimal characters
  if (!/^[a-fA-F0-9]+$/.test(hash)) {
    return "unknown";
  }
  
  switch (hash.length) {
    case 32:
      return "md5";
    case 40:
      return "sha1";
    case 56:
      return "sha224";
    case 64:
      return "sha256";
    case 96:
      return "sha384";
    case 128:
      return "sha512";
    default:
      return "unknown";
  }
}


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// IP-based access control middleware
function checkIPAccess(req: any, res: any, next: any) {
  const clientIP = getClientIP(req);
  
  console.log(`[IP ACCESS] Checking access for IP: ${clientIP}`);
  console.log(`[IP ACCESS] Headers:`, req.headers);
  
  // Get allowed IPs from settings
  storage.getSettings().then(settings => {
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const allowedIPs = settingsMap["system.apiDocsAllowedIPs"] || "";
    
    console.log(`[IP ACCESS] Allowed IPs from settings: "${allowedIPs}"`);
    
    // If no IPs configured, allow all access
    if (!allowedIPs.trim()) {
      console.log(`[IP ACCESS] No IPs configured, allowing access`);
      return next();
    }
    
    // Parse allowed IPs (one per line)
    const allowedIPList = allowedIPs.split('\n').map(ip => ip.trim()).filter(ip => ip);
    console.log(`[IP ACCESS] Parsed allowed IPs:`, allowedIPList);
    
    // Check if client IP is in allowed list
    for (const allowedIP of allowedIPList) {
      try {
        // Check if it's a CIDR range
        if (allowedIP.includes('/')) {
          const cidr = new CIDR(allowedIP);
          if (cidr.contains(clientIP)) {
            console.log(`[IP ACCESS] CIDR match found: ${clientIP} in ${allowedIP}`);
            return next();
          }
        } else {
          // Direct IP match
          if (clientIP === allowedIP) {
            console.log(`[IP ACCESS] Direct IP match found: ${clientIP}`);
            return next();
          }
        }
      } catch (error) {
        console.error('Error checking IP:', allowedIP, error);
      }
    }
    
    // IP not in allowed list
    console.log(`[IP ACCESS] Access denied for IP: ${clientIP}`);
    return res.status(403).json({ error: `Access denied from your IP address: ${clientIP}` });
  }).catch(error => {
    console.error('Error loading settings for IP check:', error);
    return res.status(500).json({ error: "Internal server error" });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, authType } = req.body;
      
      console.log(`[LOGIN] Request body:`, { username, password: password ? 'provided' : 'missing', authType });
      
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

      // For LDAP users, authenticate against LDAP server
      if (user.authType === 'ldap') {
        try {
          const ldapUser = await ldapService.authenticateUser(username, password);
          if (!ldapUser) {
            return res.status(401).json({ error: "Invalid credentials" });
          }
        } catch (error) {
          console.error('LDAP authentication error:', error);
          return res.status(401).json({ error: "Authentication failed" });
        }
      } else {
        // For local users, use password validation
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
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
        ipAddress: getClientIP(req),
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
        ipAddress: getClientIP(req),
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
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
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
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
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
        ipAddress: getClientIP(req),
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
      
      // Get the original user data to track changes
      const originalUser = await storage.getUser(id);
      if (!originalUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Track what fields are being changed
      const changedFields = [];
      if (updateData.username && updateData.username !== originalUser.username) {
        changedFields.push(`username: "${originalUser.username}" → "${updateData.username}"`);
      }
      if (updateData.firstName && updateData.firstName !== originalUser.firstName) {
        changedFields.push(`firstName: "${originalUser.firstName || 'null'}" → "${updateData.firstName}"`);
      }
      if (updateData.lastName && updateData.lastName !== originalUser.lastName) {
        changedFields.push(`lastName: "${originalUser.lastName || 'null'}" → "${updateData.lastName}"`);
      }
      if (updateData.email && updateData.email !== originalUser.email) {
        changedFields.push(`email: "${originalUser.email || 'null'}" → "${updateData.email}"`);
      }
      if (updateData.role && updateData.role !== originalUser.role) {
        changedFields.push(`role: "${originalUser.role}" → "${updateData.role}"`);
      }
      if (updateData.authType && updateData.authType !== originalUser.authType) {
        changedFields.push(`authType: "${originalUser.authType}" → "${updateData.authType}"`);
      }
      if (typeof updateData.isActive === 'boolean' && updateData.isActive !== originalUser.isActive) {
        changedFields.push(`isActive: ${originalUser.isActive} → ${updateData.isActive}`);
      }
      if (updateData.password) {
        changedFields.push('password: [changed]');
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(id, updateData);
      
      // Create detailed audit log entry
      const auditDetails = changedFields.length > 0 
        ? `Updated user "${user.username}": ${changedFields.join(', ')}`
        : `Updated user "${user.username}": no changes detected`;
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "user",
        resourceId: id.toString(),
        details: auditDetails,
        userId: (req as AuthRequest).user.userId,
        ipAddress: getClientIP(req),
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
        details: `Deleted user: ${originalUser?.username || 'unknown'}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
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
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
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
        ipAddress: getClientIP(req),
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

      try {
        const users = await ldapService.searchUsers(query);
        res.json(users);
      } catch (error) {
        console.error('LDAP search error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : "LDAP search failed" });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // LDAP connection test route
  app.post("/api/ldap/test", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { server, port, baseDN, bindDN, password, enabled, trustAllCertificates } = req.body;
      
      // Create settings object from request body
      const testSettings = {
        server: server || '',
        port: parseInt(port) || 389,
        baseDN: baseDN || '',
        bindDN: bindDN || '',
        password: password || '',
        enabled: enabled === true || enabled === 'true',
        trustAllCertificates: trustAllCertificates === true || trustAllCertificates === 'true'
      };
      
      const result = await ldapService.testConnection(testSettings);
      res.json(result);
    } catch (error) {
      console.error('LDAP test connection error:', error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Connection test failed" 
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      
      // Filter recent activity based on user role
      let filteredRecentActivity = stats.recentActivity;
      if (req.user.role === "user") {
        // Users only see fetch and blocked activities
        filteredRecentActivity = stats.recentActivity.filter((activity: any) => 
          activity.action === 'fetch' || 
          activity.action === 'block' || 
          activity.details.toLowerCase().includes('fetch') || 
          activity.details.toLowerCase().includes('block')
        );
      } else if (req.user.role === "reporter") {
        // Reporters see no recent activity
        filteredRecentActivity = [];
      }
      
      res.json({
        ...stats,
        recentActivity: filteredRecentActivity
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Data sources routes
  app.get("/api/data-sources", authenticateTokenOrApiKey, async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/data-sources", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
      });

      res.status(201).json(dataSource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/data-sources/:id", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
      });

      res.json(dataSource);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/data-sources/:id", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Data source deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pause data source endpoint
  app.post("/api/data-sources/:id/pause", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Data source paused successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resume data source endpoint
  app.post("/api/data-sources/:id/resume", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Data source resumed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual fetch endpoint
  app.post("/api/data-sources/:id/fetch", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
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
        ipAddress: getClientIP(req),
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
  app.get("/api/indicators", authenticateTokenOrApiKey, async (req, res) => {
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

  // Check if an indicator exists
  app.get("/api/indicator/check", authenticateTokenOrApiKey, async (req, res) => {
    try {
      const { value } = req.query;
      
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: "Indicator value is required and must be a string" 
        });
      }
      
      const trimmedValue = value.trim();
      
      // Try to find the indicator with both case-sensitive and case-insensitive search
      let indicator = await storage.getIndicatorByValue(trimmedValue);
      if (!indicator) {
        indicator = await storage.getIndicatorByValueCaseInsensitive(trimmedValue);
      }
      
      if (indicator) {
        res.json({
          exists: true,
          indicator: {
            id: indicator.id,
            value: indicator.value,
            type: indicator.type,
            hashType: indicator.hashType,
            isActive: indicator.isActive,
            source: indicator.source,
            tempActiveUntil: indicator.tempActiveUntil,
            createdAt: indicator.createdAt,
            createdByUser: indicator.createdByUser
          }
        });
      } else {
        res.json({
          exists: false,
          message: "Record not found"
        });
      }
    } catch (error) {
      console.error("Error checking indicator:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/indicators", authenticateTokenOrApiKey, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const { durationHours, value, notes, ...bodyData } = req.body;
      
      // Validate input
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: "Indicator value is required and must be a string" 
        });
      }
      
      // Automatically detect and validate the indicator type
      const detectedType = detectIndicatorType(value);
      if (!detectedType) {
        return res.status(400).json({ 
          error: "Invalid indicator value", 
          details: "The provided value does not match any recognized indicator pattern (IP, domain, hash, or URL)" 
        });
      }
      
      // Check if validation returned an error
      if (detectedType.type === 'error') {
        return res.status(400).json({ 
          error: "Invalid indicator value", 
          details: detectedType.error 
        });
      }
      
      // Additional validation for durationHours if provided
      if (durationHours !== undefined) {
        if (typeof durationHours !== 'number' || durationHours <= 0 || durationHours > 168) {
          return res.status(400).json({ 
            error: "Invalid duration", 
            details: "Duration must be a number between 1 and 168 hours" 
          });
        }
      }
      
      const trimmedValue = value.trim();

      // Check for duplicate indicators
      // For hashes and domains, use case-insensitive comparison; for others, use case-sensitive
      const existingIndicator = (detectedType.type === 'hash' || detectedType.type === 'domain') 
        ? await storage.getIndicatorByValueCaseInsensitive(trimmedValue)
        : await storage.getIndicatorByValue(trimmedValue);
        
      if (existingIndicator) {
        return res.status(409).json({ 
          error: "Duplicate indicator", 
          details: `Indicator with value "${trimmedValue}" already exists (ID: ${existingIndicator.id})`,
          existingIndicator: {
            id: existingIndicator.id,
            value: existingIndicator.value,
            type: existingIndicator.type,
            isActive: existingIndicator.isActive,
            createdAt: existingIndicator.createdAt
          }
        });
      }

      // Normalize hash and domain values to lowercase for consistency
      const normalizedValue = (detectedType.type === 'hash' || detectedType.type === 'domain') 
        ? trimmedValue.toLowerCase() 
        : trimmedValue;
      
      const validatedData = insertIndicatorSchema.parse({
        ...bodyData,
        value: normalizedValue,
        type: detectedType.type,
        hashType: detectedType.hashType,
        source: "manual", // Automatically assign source as manual
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
          ipAddress: getClientIP(req),
        });
        return res.status(400).json({ error: "Indicator is whitelisted" });
      }
      
      const indicator = await storage.createIndicator(validatedData);
      
      // If durationHours is provided, set temporary activation
      if (durationHours && durationHours > 0 && durationHours <= 168) {
        await storage.tempActivateIndicator(indicator.id, durationHours, req.user.userId);
      }
      
      // If notes are provided, create a note for the indicator
      if (notes && typeof notes === 'string' && notes.trim()) {
        try {
          await storage.createIndicatorNote({
            indicatorId: indicator.id,
            userId: req.user.userId,
            content: notes.trim(),
          });
        } catch (noteError) {
          console.error(`[NOTE] Failed to create note for indicator ${indicator.id}:`, noteError);
        }
      }
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "indicator",
        resourceId: indicator.id.toString(),
        details: `Created new indicator: ${indicator.value} (${detectedType.type})${durationHours ? ` with ${durationHours}h duration` : ''}${notes ? ' with notes' : ''}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.status(201).json(indicator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      
      // Handle database constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          return res.status(409).json({ 
            error: "Duplicate indicator", 
            details: "An indicator with this value already exists" 
          });
        }
      }
      
      console.error("Error creating indicator:", error);
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
        ipAddress: getClientIP(req),
      });

      res.json(indicator);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/indicators/:id", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the indicator details before deletion for logging
      const indicator = await storage.getIndicatorById(id);
      
      await storage.deleteIndicator(id);
      
      const indicatorValue = indicator?.value || "unknown";
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "indicator",
        resourceId: id.toString(),
        details: `Deleted indicator ${indicatorValue}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Indicator deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Temporary activation route
  app.post("/api/indicators/:id/temp-activate", authenticateToken, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { durationHours } = req.body;
      
      if (!durationHours || durationHours <= 0 || durationHours > 168) { // Max 1 week
        return res.status(400).json({ error: "Duration must be between 1 and 168 hours" });
      }
      
      const indicator = await storage.tempActivateIndicator(id, durationHours, req.user.userId);
      res.json(indicator);
    } catch (error) {
      console.error('Error in temporary activation:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Indicator notes routes
  app.get("/api/indicators/:id/notes", authenticateToken, async (req, res) => {
    try {
      const indicatorId = parseInt(req.params.id);
      const notes = await storage.getIndicatorNotes(indicatorId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/indicators/:id/notes", authenticateToken, requireRole(["admin", "user", "reporter"]), async (req, res) => {
    try {
      const indicatorId = parseInt(req.params.id);
      const validatedData = insertIndicatorNoteSchema.parse({
        ...req.body,
        indicatorId,
        userId: req.user.userId,
      });

      const note = await storage.createIndicatorNote(validatedData);
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "indicator_note",
        resourceId: note.id.toString(),
        details: `Added note to indicator ${indicatorId}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.put("/api/indicator-notes/:id", authenticateToken, requireRole(["admin", "user", "reporter"]), async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      const note = await storage.updateIndicatorNote(noteId, content, req.user.userId);
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "indicator_note",
        resourceId: noteId.toString(),
        details: `Updated note`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json(note);
    } catch (error) {
      if (error?.message === "Note not found or access denied") {
        res.status(403).json({ error: "Note not found or access denied" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.delete("/api/indicator-notes/:id", authenticateToken, requireRole(["admin", "user", "reporter"]), async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      await storage.deleteIndicatorNote(noteId, req.user.userId);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "indicator_note",
        resourceId: noteId.toString(),
        details: `Deleted note`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Note deleted" });
    } catch (error) {
      if (error?.message === "Note not found or access denied") {
        res.status(403).json({ error: "Note not found or access denied" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Whitelist routes
  app.get("/api/whitelist", authenticateTokenOrApiKey, async (req, res) => {
    try {
      const whitelist = await storage.getWhitelist();
      res.json(whitelist);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/whitelist", authenticateTokenOrApiKey, requireRole(["admin", "user"]), async (req, res) => {
    try {
      const { value, type, reason } = req.body;
      
      // Validate input
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: "Value is required and must be a string" 
        });
      }
      
      // Auto-detect type if not provided, or validate provided type
      let finalType = type;
      let detectedType;
      
      if (!type) {
        detectedType = detectWhitelistType(value);
        if (!detectedType) {
          return res.status(400).json({ 
            error: "Invalid whitelist value", 
            details: "The provided value does not match any recognized pattern (IP, domain, hash, or URL)" 
          });
        }
        
        // Check if detection returned an error
        if (detectedType.type === 'error') {
          return res.status(400).json({ 
            error: "Invalid whitelist value", 
            details: detectedType.error 
          });
        }
        
        finalType = detectedType.type;
      } else {
        // Validate the provided type and value combination
        detectedType = detectWhitelistType(value);
        if (!detectedType) {
          return res.status(400).json({ 
            error: "Invalid whitelist value", 
            details: "The provided value does not match any recognized pattern (IP, domain, hash, or URL)" 
          });
        }
        
        // Check if detection returned an error
        if (detectedType.type === 'error') {
          return res.status(400).json({ 
            error: "Invalid whitelist value", 
            details: detectedType.error 
          });
        }
        
        // Verify that the provided type matches the detected type
        if (type !== detectedType.type) {
          return res.status(400).json({ 
            error: "Type mismatch", 
            details: `Provided type "${type}" does not match detected type "${detectedType.type}" for value "${value}"` 
          });
        }
        
        finalType = type;
      }
      
      const validatedData = insertWhitelistSchema.parse({
        value: value.trim(),
        type: finalType,
        reason: reason || null,
        createdBy: req.user.userId,
      });

      // Validate CIDR notation for IP addresses
      if (validatedData.type === 'ip' && validatedData.value.includes('/')) {
        try {
          new CIDR(validatedData.value);
        } catch (error) {
          return res.status(400).json({ 
            error: "Invalid CIDR notation", 
            details: "Please use valid CIDR format (e.g., 192.168.1.0/24)" 
          });
        }
      }
      
      const entry = await storage.createWhitelistEntry(validatedData);
      
      // Delete any existing indicators that match this whitelist entry
      const deletedCount = await storage.deleteIndicatorsFromWhitelist(entry.value, entry.type);
      
      await storage.createAuditLog({
        level: "info",
        action: "create",
        resource: "whitelist",
        resourceId: entry.id.toString(),
        details: `Added to whitelist: ${entry.value}${deletedCount > 0 ? ` (deleted ${deletedCount} matching indicator${deletedCount > 1 ? 's' : ''})` : ''}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.status(201).json({ ...entry, deletedIndicators: deletedCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/whitelist/:id", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the whitelist entry details before deletion for logging
      const whitelistEntry = await storage.getWhitelistEntryById(id);
      if (!whitelistEntry) {
        return res.status(404).json({ error: "Whitelist entry not found" });
      }
      
      await storage.deleteWhitelistEntry(id);
      
      await storage.createAuditLog({
        level: "info",
        action: "delete",
        resource: "whitelist",
        resourceId: id.toString(),
        details: `Removed from whitelist: ${whitelistEntry.value} (${whitelistEntry.type})`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Whitelist entry deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk delete whitelist entries
  app.post("/api/whitelist/bulk-delete", authenticateTokenOrApiKey, requireRole(["admin"]), async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: "IDs array is required and must not be empty" 
        });
      }
      
      let successCount = 0;
      let errorCount = 0;
      let deletedEntries: string[] = [];
      
      for (const id of ids) {
        try {
          // Get the whitelist entry details before deletion for logging
          const whitelistEntry = await storage.getWhitelistEntryById(parseInt(id));
          if (whitelistEntry) {
            await storage.deleteWhitelistEntry(parseInt(id));
            deletedEntries.push(`${whitelistEntry.value} (${whitelistEntry.type})`);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }
      
      await storage.createAuditLog({
        level: "info",
        action: "bulk_delete",
        resource: "whitelist",
        details: `Bulk deleted ${successCount} whitelist entries: ${deletedEntries.join(', ')}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        userId: req.user.userId,
        ipAddress: getClientIP(req),
      });

      res.json({ 
        message: `Bulk deletion completed`, 
        deleted: successCount, 
        errors: errorCount 
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check if value is whitelisted
  app.post("/api/whitelist/check", authenticateTokenOrApiKey, async (req, res) => {
    try {
      const { value, type } = req.body;
      
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: "Value is required and must be a string" 
        });
      }
      
      // Auto-detect type if not provided
      let finalType = type;
      if (!type) {
        const detectedType = detectWhitelistType(value);
        if (!detectedType) {
          return res.status(400).json({ 
            error: "Invalid value", 
            details: "The provided value does not match any recognized pattern (IP, domain, hash, or URL)" 
          });
        }
        finalType = detectedType.type;
      }
      
      const isWhitelisted = await storage.isWhitelisted(value.trim(), finalType);
      
      res.json({ 
        value: value.trim(), 
        type: finalType,
        isWhitelisted 
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Whitelist blocks routes
  app.get("/api/whitelist/blocks", authenticateTokenOrApiKey, async (req, res) => {
    try {
      const { page = 1, limit = 25 } = req.query;
      const blocks = await storage.getWhitelistBlocks(
        parseInt(page as string),
        parseInt(limit as string)
      );
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audit logs routes
  app.get("/api/audit-logs", authenticateToken, requireRole(["admin"]), async (req, res) => {
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

  app.get("/api/audit-logs/export", authenticateToken, requireRole(["admin"]), async (req, res) => {
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
      
      // Filter out sensitive settings that should not be exposed to the frontend
      const sensitiveKeys = [
        'ldap.password',
        'proxy.password'
      ];
      
      const filteredSettings = settings.filter(setting => 
        !sensitiveKeys.includes(setting.key)
      );
      
      res.json(filteredSettings);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      console.log('Settings update request:', req.body);
            
      // Get current settings to track changes
      const currentSettings = await storage.getSettings();
      const currentSettingsMap = Object.fromEntries(currentSettings.map(s => [s.key, s.value]));
      
      // Track which settings are being changed
      const changedSettings = [];
      for (const [key, newValue] of Object.entries(req.body)) {
        const currentValue = currentSettingsMap[key];
        if (currentValue !== newValue) {
          // Don't log sensitive values like passwords in detail
          if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
            changedSettings.push(`${key}: [changed]`);
          } else {
            changedSettings.push(`${key}: "${currentValue || 'undefined'}" → "${newValue}"`);
          }
        }
      }
      
      await storage.updateSettings(req.body, (req as AuthRequest).user.userId);
      
      // Create detailed audit log entry
      const auditDetails = changedSettings.length > 0 
        ? `Updated system settings: ${changedSettings.join(', ')}`
        : "Updated system settings: no changes detected";
      
      await storage.createAuditLog({
        level: "info",
        action: "update",
        resource: "settings",
        details: auditDetails,
        userId: (req as AuthRequest).user.userId,
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Settings updated" });
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(500).json({ error: "Internal server error", details: error.message });
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
        ipAddress: getClientIP(req),
      });

      res.json({ message: "LDAP connection test successful" });
    } catch (error) {
      res.status(500).json({ error: "LDAP connection test failed" });
    }
  });

  // Public blacklist files
  app.use("/public/blacklist", express.static(path.join(process.cwd(), "public/blacklist")));

  // Protected public-links endpoints for authenticated users
  app.get("/api/public-links/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getPublicFileStats();
      res.json(stats);
    } catch (error) {
      console.error("Public file stats error:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  app.get("/api/public-links/files", authenticateToken, async (req, res) => {
    try {
      const blacklistPath = path.join(process.cwd(), "public/blacklist");
      const types = ["IP", "Domain", "Hash", "URL", "Proxy"];
      const files: Record<string, string[]> = {};

      for (const type of types) {
        const typePath = path.join(blacklistPath, type);
        try {
          const typeFiles = await fs.readdir(typePath);
          files[type] = typeFiles.filter(file => file.endsWith('.txt'));
        } catch (error) {
          files[type] = [];
        }
      }

      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Public API endpoints for unauthenticated access
  app.get("/api/public/blacklist/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicFileStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/public/blacklist/files", async (req, res) => {
    try {
      const blacklistPath = path.join(process.cwd(), "public/blacklist");
      const types = ["IP", "Domain", "Hash", "URL", "Proxy"];
      const files: Record<string, string[]> = {};

      for (const type of types) {
        const typePath = path.join(blacklistPath, type);
        try {
          const typeFiles = await fs.readdir(typePath);
          files[type] = typeFiles.filter(file => file.endsWith('.txt'));
        } catch (error) {
          files[type] = [];
        }
      }

      res.json(files);
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
        ipAddress: getClientIP(req),
      });

      res.json({ message: "Blacklist refresh initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh blacklist" });
    }
  });

  // API token routes
  app.get("/api/tokens", authenticateToken, async (req, res) => {
    try {
      const tokens = await storage.getApiTokens((req as AuthRequest).user.userId);
      // Remove sensitive token values from response
      const sanitizedTokens = tokens.map(token => ({
        ...token,
        token: token.token.substring(0, 8) + "..." + token.token.substring(token.token.length - 8)
      }));
      res.json(sanitizedTokens);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tokens", authenticateToken, async (req, res) => {
    try {
      const { name, expiresAt } = req.body;
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Token name is required" });
      }

      const { generateApiToken } = await import("./auth");
      const token = generateApiToken();
      const newToken = await storage.createApiToken({
        name: name.trim(),
        token,
        userId: (req as AuthRequest).user.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      });

      // Log the creation
      await storage.createAuditLog({
        level: "info",
        action: "create_api_token",
        resource: "api_token",
        resourceId: newToken.id.toString(),
        details: `Created API token: ${name}`,
        userId: (req as AuthRequest).user.userId,
        ipAddress: getClientIP(req)
      });

      res.status(201).json({ ...newToken, token }); // Return full token only on creation
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/tokens/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteApiToken(id, (req as AuthRequest).user.userId);
      
      // Log the deletion
      await storage.createAuditLog({
        level: "info",
        action: "delete_api_token",
        resource: "api_token",
        resourceId: id.toString(),
        details: `Deleted API token`,
        userId: (req as AuthRequest).user.userId,
        ipAddress: getClientIP(req)
      });

      res.json({ message: "Token deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/tokens/:id/revoke", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.revokeApiToken(id, (req as AuthRequest).user.userId);
      
      // Log the revocation
      await storage.createAuditLog({
        level: "info",
        action: "revoke_api_token",
        resource: "api_token",
        resourceId: id.toString(),
        details: `Revoked API token`,
        userId: (req as AuthRequest).user.userId,
        ipAddress: getClientIP(req)
      });

      res.json({ message: "Token revoked successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // IP information endpoint
  app.get("/api/my-ip", (req, res) => {
    const clientIP = getClientIP(req);
    res.json({ ip: clientIP });
  });

  // API documentation access control route
  app.get("/api-docs", checkIPAccess, authenticateTokenOrApiKey, requireRole(["admin", "user"]), (req, res) => {
    // This route requires both IP access control and authentication with admin/user role
    // Reporter role is not allowed to access API documentation
    res.status(200).json({ message: "API documentation access granted" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
