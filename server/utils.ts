import type { Request } from "express";

/**
 * Extract the real client IP address from the request
 * Handles proxy headers properly for Replit environment
 */
export function getClientIP(req: Request): string {
  // Check for forwarded headers first (most reliable for proxy environments)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, the first one is the original client
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstIP = ips.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  // Check other common proxy headers
  const xRealIP = req.headers['x-real-ip'];
  if (xRealIP && typeof xRealIP === 'string') {
    return xRealIP.trim();
  }

  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP && typeof cfConnectingIP === 'string') {
    return cfConnectingIP.trim();
  }

  // Fall back to Express's built-in ip property (works when trust proxy is set)
  if (req.ip) {
    return req.ip;
  }

  // Last resort - direct socket address
  const socketIP = req.socket?.remoteAddress;
  if (socketIP) {
    return socketIP;
  }

  // Default fallback
  return 'unknown';
}