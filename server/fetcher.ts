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

// Track active fetches to prevent overlap
const activeFetches = new Set<number>();

export async function fetchAndParseData(source: DataSource): Promise<void> {
  // Check if fetch is already in progress for this source
  if (activeFetches.has(source.id)) {
    console.log(`[FETCH] Skipping ${source.name} - fetch already in progress`);
    return;
  }

  activeFetches.add(source.id);
  
  try {
    await fetchWithRetry(source);
  } finally {
    activeFetches.delete(source.id);
  }
}

async function fetchWithRetry(source: DataSource, maxRetries: number = 3): Promise<void> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FETCH] Starting fetch for ${source.name} from ${source.url} (attempt ${attempt}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[FETCH] Aborting fetch for ${source.name} due to timeout`);
        controller.abort();
      }, 60000); // 1 minute timeout per attempt
      
      try {
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'ThreatIntel-Platform/1.0',
            'Accept': 'text/plain, */*',
            'Connection': 'close',
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
          keepalive: false,
        });

        clearTimeout(timeoutId);

        console.log(`[FETCH] Response received: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.text();
        console.log(`[FETCH] Fetched ${data.length} characters from ${source.name}`);
        
        // Parse data immediately
        const parsed = parseData(data);
        console.log(`[FETCH] Parsed indicators: IPs=${parsed.ips.length}, Domains=${parsed.domains.length}, Hashes=${parsed.hashes.length}, URLs=${parsed.urls.length}`);
        
        // Update source status to indicate fetch is complete, processing started
        await storage.updateDataSourceStatus(source.id, "processing", null);
        
        // Process all indicators synchronously to ensure completion
        await processAllIndicators(source, parsed);
        
        // Success - exit retry loop
        return;
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`[FETCH] Attempt ${attempt} failed for ${source.name}:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.log(`[FETCH] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  if (lastError) {
    await handleFetchError(source, lastError);
  }
}

async function processAllIndicators(source: DataSource, parsed: ParsedIndicators): Promise<void> {
  const allProcessingPromises: Promise<void>[] = [];
  
  for (const indicatorType of source.indicatorTypes) {
    let indicators: string[] = [];
    let hashType: string | undefined;

    switch (indicatorType) {
      case "ip":
        indicators = parsed.ips;
        break;
      case "domain":
        indicators = parsed.domains;
        break;
      case "hash":
        indicators = parsed.hashes;
        hashType = indicators.length > 0 ? detectHashType(indicators[0]) : undefined;
        break;
      case "url":
        indicators = parsed.urls;
        break;
    }
    
    if (indicators.length > 0) {
      console.log(`[FETCH] Processing ${indicators.length} indicators for type: ${indicatorType}`);
      allProcessingPromises.push(
        processIndicatorsInBackground(source, indicators, hashType, indicatorType)
      );
    } else {
      console.log(`[FETCH] No indicators found for type: ${indicatorType}`);
    }
  }
  
  // Wait for all indicator processing to complete
  await Promise.all(allProcessingPromises);
  console.log(`[FETCH] All indicator processing completed for ${source.name}`);
}

async function handleFetchError(source: DataSource, error: Error): Promise<void> {
  let errorMessage = "Unknown error";
  if (error.name === 'AbortError') {
    errorMessage = "Request timeout";
  } else if (error.message.includes('ECONNRESET')) {
    errorMessage = "Connection reset by remote server";
  } else if (error.message.includes('ENOTFOUND')) {
    errorMessage = "DNS resolution failed";
  } else if (error.message.includes('ECONNREFUSED')) {
    errorMessage = "Connection refused";
  } else {
    errorMessage = error.message;
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

async function processIndicatorsInBackground(source: DataSource, indicators: string[], hashType?: string, indicatorType?: string): Promise<void> {
  try {
    console.log(`[PROCESS] Starting optimized processing of ${indicators.length} indicators for ${source.name}`);
    
    // Bulk filter whitelisted indicators - much faster than individual checks
    const FILTER_BATCH_SIZE = 5000; // Larger batches for bulk operations
    const validIndicators = [];
    let whitelistBlocked = 0;
    
    for (let i = 0; i < indicators.length; i += FILTER_BATCH_SIZE) {
      const batch = indicators.slice(i, i + FILTER_BATCH_SIZE);
      
      // Use bulk whitelist check instead of individual queries
      const whitelistedSet = await storage.bulkCheckWhitelist(batch, indicatorType || 'unknown');
      
      for (const indicator of batch) {
        if (!whitelistedSet.has(indicator)) {
          validIndicators.push(indicator);
        } else {
          whitelistBlocked++;
        }
      }
      
      // Progress update every batch
      console.log(`[PROCESS] Filtered ${Math.min(i + FILTER_BATCH_SIZE, indicators.length)}/${indicators.length} indicators (${validIndicators.length} valid, ${whitelistBlocked} blocked)`);
    }

    console.log(`[PROCESS] Bulk saving ${validIndicators.length} valid indicators to database`);
    
    // Use bulk database operations for much better performance
    const SAVE_BATCH_SIZE = 1000; // Larger batches for bulk inserts
    let savedCount = 0;
    
    for (let i = 0; i < validIndicators.length; i += SAVE_BATCH_SIZE) {
      const batch = validIndicators.slice(i, i + SAVE_BATCH_SIZE);
      
      try {
        // Prepare batch data for bulk insert
        const batchData = batch.map(indicator => ({
          value: indicator,
          type: indicatorType || 'unknown',
          hashType,
          source: source.name,
          sourceId: source.id,
          isActive: true,
          createdBy: 1, // Default to admin user for system fetches
        }));
        
        // Use bulk insert/update operation
        const batchSavedCount = await storage.bulkCreateOrUpdateIndicators(batchData);
        savedCount += batchSavedCount;
        
        console.log(`[PROCESS] Bulk saved batch ${Math.floor(i/SAVE_BATCH_SIZE) + 1}/${Math.ceil(validIndicators.length/SAVE_BATCH_SIZE)}: ${batchSavedCount} indicators (total: ${savedCount}/${validIndicators.length})`);
        
      } catch (error) {
        console.error(`[PROCESS] Error in bulk save for batch starting at ${i}:`, error);
        // If bulk operation fails, we could fall back to individual inserts, but for now just log and continue
      }
    }
    
    console.log(`[PROCESS] Completed processing ${source.name}: ${savedCount} indicators saved`);

    // Update source status to success
    await storage.updateDataSourceStatus(source.id, "success", null);

    await storage.createAuditLog({
      level: "info",
      action: "fetch",
      resource: "data_source",
      resourceId: source.id.toString(),
      details: `Successfully processed ${savedCount} indicators from ${source.name}`,
      metadata: {
        totalFetched: indicators.length,
        validIndicators: validIndicators.length,
        whitelistBlocked: whitelistBlocked,
        savedIndicators: savedCount,
      },
    });

  } catch (error) {
    console.error(`[PROCESS] Error processing indicators for ${source.name}:`, error);
    
    // Update source status to error
    await storage.updateDataSourceStatus(source.id, "error", `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    await storage.createAuditLog({
      level: "error",
      action: "process",
      resource: "data_source",
      resourceId: source.id.toString(),
      details: `Failed to process indicators from ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
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
