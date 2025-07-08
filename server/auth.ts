import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export interface AuthRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: string;
  };
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function authenticateApiToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "API token required" });
  }

  try {
    const apiToken = await storage.getApiTokenByToken(token);
    if (!apiToken) {
      return res.status(403).json({ error: "Invalid API token" });
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return res.status(403).json({ error: "API token expired" });
    }

    // Update last used timestamp
    await storage.updateApiTokenLastUsed(token);

    // Get user info
    const user = await storage.getUser(apiToken.userId);
    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }

    (req as AuthRequest).user = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid API token" });
  }
}

export function authenticateTokenOrApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  const token = authHeader.split(" ")[1];
  
  // Try JWT first
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as AuthRequest).user = decoded;
    return next();
  } catch (error) {
    // If JWT fails, try API token
    return authenticateApiToken(req, res, next);
  }
}
