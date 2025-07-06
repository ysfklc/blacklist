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
  let timeoutId: NodeJS.Timeout | undefined;
  
  try {
    console.log(`[FETCH] Starting fetch for ${source.name} from ${source.url}`);
    
    // Create an AbortController for timeout - extended for large datasets
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      console.log(`[FETCH] Aborting fetch for ${source.name} due to timeout`);
      controller.abort();
    }, 60000); // Increased to 60 seconds for large datasets
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'ThreatIntel-Platform/1.0',
        'Accept': 'text/plain, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    timeoutId = undefined;

    console.log(`[FETCH] Response received: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    console.log(`Fetched ${data.length} characters from ${source.name}`);
    
    const parsed = parseData(data);
    console.log(`Parsed indicators: IPs=${parsed.ips.length}, Domains=${parsed.domains.length}, Hashes=${parsed.hashes.length}, URLs=${parsed.urls.length}`);
    
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
    
    console.log(`Selected ${indicators.length} indicators for type: ${source.indicatorType}`);
    console.log(`[FETCH] Processing all ${indicators.length} indicators without limitation`);

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

    // Save indicators to database in batches
    console.log(`[FETCH] Saving ${validIndicators.length} indicators to database in batches`);
    
    const BATCH_SIZE = 50; // Reduced batch size for better stability
    let savedCount = 0;
    
    for (let i = 0; i < validIndicators.length; i += BATCH_SIZE) {
      const batch = validIndicators.slice(i, i + BATCH_SIZE);
      
      try {
        // Process batch with Promise.allSettled for better error handling
        const results = await Promise.allSettled(
          batch.map(indicator => 
            storage.createOrUpdateIndicator({
              value: indicator,
              type: source.indicatorType,
              hashType,
              source: source.name,
              sourceId: source.id,
              isActive: true,
            })
          )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        savedCount += successful;
        
        if (savedCount % 1000 === 0 || i + BATCH_SIZE >= validIndicators.length) {
          console.log(`[FETCH] Saved ${savedCount}/${validIndicators.length} indicators (batch ${Math.floor(i/BATCH_SIZE) + 1})`);
        }
        
        // Small delay between batches to prevent overwhelming the database
        if (i + BATCH_SIZE < validIndicators.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
      } catch (error) {
        console.error(`[FETCH] Error saving batch starting at ${i}:`, error);
      }
    }
    
    console.log(`[FETCH] Completed saving ${savedCount} indicators`);

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
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.error(`[FETCH] Error fetching from ${source.name}:`, error);
    
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = "Request timeout after 30 seconds";
      } else if (error.message.includes('ECONNRESET')) {
        errorMessage = "Connection reset by remote server";
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = "DNS resolution failed";
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = "Connection refused";
      } else {
        errorMessage = error.message;
      }
    }
    
    console.log(`[FETCH] Setting error status for ${source.name}: ${errorMessage}`);
    
    await storage.updateDataSourceStatus(source.id, "error", errorMessage);

    await storage.createAuditLog({
      level: "error",
      action: "fetch",
      resource: "data_source",
      resourceId: source.id.toString(),
      details: `Failed to fetch from ${source.name}: ${errorMessage}`,
      metadata: {
        error: errorMessage,
        url: source.url,
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
