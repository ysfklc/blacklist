import { DataSource } from "@shared/schema";
import { storage } from "./storage";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

interface ParsedIndicators {
  ips: string[];
  domains: string[];
  hashes: string[];
  urls: string[];
  soarUrls: string[];
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
        // Get proxy settings from storage
        const proxySettings = await getProxySettings();
        let agent: any = undefined;
        
        if (proxySettings.enabled && proxySettings.host && proxySettings.port) {
          const proxyUrl = `http://${proxySettings.host}:${proxySettings.port}`;
          const proxyAuth = proxySettings.username && proxySettings.password 
            ? `${proxySettings.username}:${proxySettings.password}@`
            : '';
          const fullProxyUrl = `http://${proxyAuth}${proxySettings.host}:${proxySettings.port}`;
          
          // Choose the appropriate agent based on the target URL protocol
          if (source.url.startsWith('https:')) {
            agent = new HttpsProxyAgent(fullProxyUrl);
            // If ignoring certificate errors, configure the proxy agent
            if (source.ignoreCertificateErrors) {
              agent.options.rejectUnauthorized = false;
            }
          } else {
            agent = new HttpProxyAgent(fullProxyUrl);
          }
          
          console.log(`[FETCH] Using proxy: ${proxyUrl}`);
        } else if (source.ignoreCertificateErrors && source.url.startsWith('https:')) {
          // Create custom HTTPS agent that ignores certificate errors
          agent = new https.Agent({
            rejectUnauthorized: false
          });
          console.log(`[FETCH] Ignoring SSL certificate errors for ${source.name}`);
        } else if (!source.url.startsWith('https:')) {
          // For HTTP, use a simple HTTP agent
          agent = new http.Agent();
        }
        
        // Configure fetch options
        const fetchOptions: any = {
          headers: {
            'User-Agent': 'TheBlackList-Platform/1.0',
            'Accept': 'text/plain, */*',
            'Connection': 'close',
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
          keepalive: false,
          agent,
        };
        
        const response = await fetch(source.url, fetchOptions);

        clearTimeout(timeoutId);

        console.log(`[FETCH] Response received: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.text();
        console.log(`[FETCH] Fetched ${data.length} characters from ${source.name}`);
        
        // Parse data immediately
        const parsed = parseData(data, source);
        console.log(`[FETCH] Parsed indicators: IPs=${parsed.ips.length}, Domains=${parsed.domains.length}, Hashes=${parsed.hashes.length}, URLs=${parsed.urls.length}, SOAR-URLs=${parsed.soarUrls.length}`);
        
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
      const errorDetails = error instanceof Error ? error.message : String(error);
      console.error(`[FETCH] Attempt ${attempt} failed for ${source.name}: ${errorDetails}`);
      console.error(`[FETCH] URL: ${source.url}`);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.log(`[FETCH] Retrying in ${delay}ms... (${maxRetries - attempt} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[FETCH] All ${maxRetries} attempts failed for ${source.name}`);
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
      case "soar-url":
        indicators = parsed.soarUrls;
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
  let errorCode = "";
  let httpStatus = "";
  let hostname = "";
  
  try {
    hostname = new URL(source.url).hostname;
  } catch {
    hostname = source.url;
  }
  
  // Deep error analysis - check the error object and its cause
  const fullErrorText = JSON.stringify(error, Object.getOwnPropertyNames(error));
  const errorString = error.toString();
  const errorCause = (error as any).cause;
  
  console.log(`[FETCH] Analyzing error for ${source.name}:`);
  console.log(`[FETCH] Error name: ${error.name}`);
  console.log(`[FETCH] Error message: ${error.message}`);
  console.log(`[FETCH] Error cause:`, errorCause);
  
  // Enhanced error categorization with deeper inspection
  if (error.name === 'AbortError') {
    errorMessage = "Request timeout (exceeded 60 seconds)";
    errorCode = "TIMEOUT";
  } else if (errorCause || (error as any).code) {
    // Check the underlying cause or error code
    const cause = errorCause || error;
    const code = (cause as any).code || (cause as any).errno;
    const syscall = (cause as any).syscall;
    
    console.log(`[FETCH] Underlying error code: ${code}, syscall: ${syscall}`);
    
    if (code === 'ENOTFOUND' || code === -3008) {
      errorMessage = `DNS resolution failed - hostname '${hostname}' not found`;
      errorCode = "ENOTFOUND";
    } else if (code === 'ECONNREFUSED' || code === -61) {
      errorMessage = `Connection refused by remote server '${hostname}'`;
      errorCode = "ECONNREFUSED";
    } else if (code === 'ECONNRESET' || code === -54) {
      errorMessage = `Connection reset by remote server '${hostname}'`;
      errorCode = "ECONNRESET";
    } else if (code === 'EHOSTUNREACH' || code === -65) {
      errorMessage = `Host '${hostname}' unreachable`;
      errorCode = "EHOSTUNREACH";
    } else if (code === 'ENETUNREACH' || code === -51) {
      errorMessage = `Network unreachable to '${hostname}'`;
      errorCode = "ENETUNREACH";
    } else if (code === 'ETIMEDOUT' || code === -60) {
      errorMessage = `Connection timeout to '${hostname}'`;
      errorCode = "ETIMEDOUT";
    } else if (code === 'EPROTO' || syscall === 'read') {
      errorMessage = `Protocol error (SSL/TLS handshake failed) with '${hostname}'`;
      errorCode = "EPROTO";
    } else if (cause.message && cause.message.includes('certificate')) {
      errorMessage = `SSL certificate error for '${hostname}'`;
      errorCode = "SSL_CERT_ERROR";
    } else {
      errorMessage = `Network error: ${cause.message || error.message} (${hostname})`;
      errorCode = code || error.name || "NETWORK_ERROR";
    }
  } else if (error.message.includes('ENOTFOUND')) {
    errorMessage = `DNS resolution failed - hostname '${hostname}' not found`;
    errorCode = "ENOTFOUND";
  } else if (error.message.includes('ECONNREFUSED')) {
    errorMessage = `Connection refused by remote server '${hostname}'`;
    errorCode = "ECONNREFUSED";
  } else if (error.message.includes('ECONNRESET')) {
    errorMessage = `Connection reset by remote server '${hostname}'`;
    errorCode = "ECONNRESET";
  } else if (error.message.includes('timeout')) {
    errorMessage = `Request timeout to '${hostname}'`;
    errorCode = "TIMEOUT";
  } else if (error.message.startsWith('HTTP')) {
    // Handle HTTP status errors
    errorMessage = `${error.message} from '${hostname}'`;
    errorCode = "HTTP_ERROR";
    const statusMatch = error.message.match(/HTTP (\d+)/);
    if (statusMatch) {
      httpStatus = ` (HTTP ${statusMatch[1]})`;
      errorCode = `HTTP_${statusMatch[1]}`;
    }
  } else {
    errorMessage = `${error.message} (${hostname})`;
    errorCode = error.name || "UNKNOWN";
  }
  
  const detailedError = `${errorMessage}${httpStatus}`;
  
  console.log(`[FETCH] Setting error status for ${source.name}: ${detailedError}`);
  console.log(`[FETCH] Full error details - URL: ${source.url}, Error Code: ${errorCode}, Hostname: ${hostname}`);
  
  await storage.updateDataSourceStatus(source.id, "error", detailedError);

  await storage.createAuditLog({
    level: "error",
    action: "fetch",
    resource: "data_source",
    resourceId: source.id.toString(),
    details: `Failed to fetch from ${source.name}: ${detailedError} - URL: ${source.url}`,
    metadata: {
      error: detailedError,
      errorCode: errorCode,
      url: source.url,
      hostname: hostname,
      fullErrorMessage: error.message,
      errorCause: errorCause ? JSON.stringify(errorCause, Object.getOwnPropertyNames(errorCause)) : null,
      errorStack: error.stack?.substring(0, 500),
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
          // Record this as a whitelist block
          try {
            await storage.recordWhitelistBlock(indicator, indicatorType || 'unknown', source.name, source.id);
          } catch (error) {
            console.warn(`Failed to record whitelist block for ${indicator}:`, error);
          }
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

function parseData(data: string, source: DataSource): ParsedIndicators {
  const ips = Array.from(new Set(data.match(IP_REGEX) || []));
  const domains = Array.from(new Set(data.match(DOMAIN_REGEX) || []));
  const hashes = Array.from(new Set(data.match(HASH_REGEX) || []));
  const urls = Array.from(new Set(data.match(URL_REGEX) || []));
  
  // For SOAR-URL type, process line by line without regex filtering or deduplication
  let soarUrls: string[] = [];
  if (source.indicatorTypes.includes('soar-url')) {
    const lines = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
    soarUrls = lines;
    console.log(`[FETCH] SOAR-URL processing: ${lines.length} lines found (first 5): ${lines.slice(0, 5).join(', ')}`);
  }

  return { ips, domains, hashes, urls, soarUrls };
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

async function getProxySettings(): Promise<{
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
}> {
  try {
    const settings = await storage.getSettings();
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
    
    return {
      enabled: settingsMap["proxy.enabled"] === "true",
      host: settingsMap["proxy.host"] || "",
      port: parseInt(settingsMap["proxy.port"] || "8080"),
      username: settingsMap["proxy.username"] || "",
      password: settingsMap["proxy.password"] || "",
    };
  } catch (error) {
    console.error("[FETCH] Error getting proxy settings:", error);
    return {
      enabled: false,
      host: "",
      port: 8080,
      username: "",
      password: "",
    };
  }
}
