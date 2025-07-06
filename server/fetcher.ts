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
  let timeoutId: NodeJS.Timeout | undefined;
  
  try {
    console.log(`[FETCH] Starting fetch for ${source.name} from ${source.url}`);
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      console.log(`[FETCH] Aborting fetch for ${source.name} due to timeout`);
      controller.abort();
    }, 120000); // 2 minutes for large datasets
    
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
    console.log(`[FETCH] Fetched ${data.length} characters from ${source.name}`);
    
    // Parse data immediately
    const parsed = parseData(data);
    console.log(`[FETCH] Parsed indicators: IPs=${parsed.ips.length}, Domains=${parsed.domains.length}, Hashes=${parsed.hashes.length}, URLs=${parsed.urls.length}`);
    
    // Update source status to indicate fetch is complete, processing started
    await storage.updateDataSourceStatus(source.id, "processing", null);
    
    // Process indicators for each selected type
    const processingPromises: Promise<void>[] = [];
    
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
        console.log(`[FETCH] Selected ${indicators.length} indicators for type: ${indicatorType}`);
        
        // Process indicators in background for this type (don't await)
        processingPromises.push(
          processIndicatorsInBackground(source, indicators, hashType, indicatorType)
        );
      } else {
        console.log(`[FETCH] No indicators found for type: ${indicatorType}`);
      }
    }

  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.error(`[FETCH] Error fetching from ${source.name}:`, error);
    
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = "Request timeout after 2 minutes";
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
  } finally {
    activeFetches.delete(source.id);
  }
}

async function processIndicatorsInBackground(source: DataSource, indicators: string[], hashType?: string, indicatorType?: string): Promise<void> {
  try {
    console.log(`[PROCESS] Starting background processing of ${indicators.length} indicators for ${source.name}`);
    
    // Filter out whitelisted indicators in batches
    const validIndicators = [];
    const FILTER_BATCH_SIZE = 1000;
    let whitelistBlocked = 0;
    
    for (let i = 0; i < indicators.length; i += FILTER_BATCH_SIZE) {
      const batch = indicators.slice(i, i + FILTER_BATCH_SIZE);
      
      for (const indicator of batch) {
        const isWhitelisted = await storage.isWhitelisted(indicator, indicatorType || 'unknown');
        if (!isWhitelisted) {
          validIndicators.push(indicator);
        } else {
          whitelistBlocked++;
        }
      }
      
      // Progress update every 10k indicators
      if ((i + FILTER_BATCH_SIZE) % 10000 === 0 || i + FILTER_BATCH_SIZE >= indicators.length) {
        console.log(`[PROCESS] Filtered ${i + FILTER_BATCH_SIZE}/${indicators.length} indicators (${validIndicators.length} valid, ${whitelistBlocked} blocked)`);
      }
    }

    console.log(`[PROCESS] Saving ${validIndicators.length} valid indicators to database`);
    
    // Save indicators to database in batches
    const SAVE_BATCH_SIZE = 50; // Reduced batch size for better stability
    let savedCount = 0;
    
    for (let i = 0; i < validIndicators.length; i += SAVE_BATCH_SIZE) {
      const batch = validIndicators.slice(i, i + SAVE_BATCH_SIZE);
      console.log(`[PROCESS] Processing batch ${Math.floor(i/SAVE_BATCH_SIZE) + 1}/${Math.ceil(validIndicators.length/SAVE_BATCH_SIZE)}: indicators ${i+1}-${Math.min(i+SAVE_BATCH_SIZE, validIndicators.length)}`);
      
      try {
        // Process batch with Promise.allSettled for better error handling
        const results = await Promise.allSettled(
          batch.map(indicator => 
            storage.createOrUpdateIndicator({
              value: indicator,
              type: indicatorType || 'unknown',
              hashType,
              source: source.name,
              sourceId: source.id,
              isActive: true,
              createdBy: 1, // Default to admin user for system fetches
            })
          )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          console.log(`[PROCESS] Batch had ${failed.length} failures:`);
          failed.slice(0, 3).forEach((failure, index) => {
            console.log(`[PROCESS] Error ${index + 1}:`, failure.reason);
          });
        }
        
        savedCount += successful;
        
        // Progress update every 1k saved
        if (savedCount % 1000 === 0 || i + SAVE_BATCH_SIZE >= validIndicators.length) {
          console.log(`[PROCESS] Saved ${savedCount}/${validIndicators.length} indicators (batch ${Math.floor(i/SAVE_BATCH_SIZE) + 1})`);
        }
        
        // Small delay between batches to prevent overwhelming the database
        if (i + SAVE_BATCH_SIZE < validIndicators.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`[PROCESS] Error saving batch starting at ${i}:`, error);
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
