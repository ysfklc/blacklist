import { DataSource } from "@shared/schema";
import { storage } from "./storage";

interface ParsedIndicators {
  ips: string[];
  domains: string[];
  hashes: string[];
  urls: string[];
}

const IP_REGEX = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
const DOMAIN_REGEX = /(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/g;
const HASH_REGEX = /\b[a-fA-F0-9]{32,128}\b/g;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export async function fetchAndParseData(source: DataSource): Promise<void> {
  try {
    console.log(`Fetching data from ${source.url}`);
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'ThreatIntel-Platform/1.0',
      },
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    const parsed = parseData(data);
    
    let indicators: string[] = [];
    let hashType: string | undefined;

    switch (source.indicatorType) {
      case "ip":
        indicators = parsed.ips;
        break;
      case "domain":
        indicators = parsed.domains;
        break;
      case "hash":
        indicators = parsed.hashes;
        hashType = detectHashType(indicators[0]);
        break;
      case "url":
        indicators = parsed.urls;
        break;
    }

    // Filter out whitelisted indicators
    const validIndicators = [];
    for (const indicator of indicators) {
      const isWhitelisted = await storage.isWhitelisted(indicator, source.indicatorType);
      if (!isWhitelisted) {
        validIndicators.push(indicator);
      } else {
        // Log whitelist block
        await storage.createAuditLog({
          level: "warning",
          action: "blocked",
          resource: "indicator",
          details: `Whitelist blocked indicator: ${indicator} from ${source.name}`,
          metadata: {
            sourceId: source.id,
            sourceUrl: source.url,
          },
        });
      }
    }

    // Save indicators to database
    for (const indicator of validIndicators) {
      await storage.createOrUpdateIndicator({
        value: indicator,
        type: source.indicatorType,
        hashType,
        source: source.name,
        sourceId: source.id,
        isActive: true,
      });
    }

    // Update source status
    await storage.updateDataSourceStatus(source.id, "success", null);

    await storage.createAuditLog({
      level: "info",
      action: "fetch",
      resource: "data_source",
      resourceId: source.id.toString(),
      details: `Successfully fetched ${validIndicators.length} indicators from ${source.name}`,
      metadata: {
        totalFetched: indicators.length,
        validIndicators: validIndicators.length,
        whitelistBlocked: indicators.length - validIndicators.length,
      },
    });

  } catch (error) {
    console.error(`Error fetching from ${source.name}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await storage.updateDataSourceStatus(source.id, "error", errorMessage);

    await storage.createAuditLog({
      level: "error",
      action: "fetch",
      resource: "data_source",
      resourceId: source.id.toString(),
      details: `Failed to fetch from ${source.name}: ${errorMessage}`,
      metadata: {
        error: errorMessage,
      },
    });
  }
}

function parseData(data: string): ParsedIndicators {
  const ips = Array.from(new Set(data.match(IP_REGEX) || []));
  const domains = Array.from(new Set(data.match(DOMAIN_REGEX) || []));
  const hashes = Array.from(new Set(data.match(HASH_REGEX) || []));
  const urls = Array.from(new Set(data.match(URL_REGEX) || []));

  return { ips, domains, hashes, urls };
}

function detectHashType(hash: string): string {
  if (!hash) return "unknown";
  
  switch (hash.length) {
    case 32:
      return "md5";
    case 40:
      return "sha1";
    case 64:
      return "sha256";
    case 128:
      return "sha512";
    default:
      return "unknown";
  }
}
