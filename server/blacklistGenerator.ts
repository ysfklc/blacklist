import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";

const BLACKLIST_DIR = path.join(process.cwd(), "public", "blacklist");

export async function generateBlacklistFiles(): Promise<void> {
  try {
    // Get max file size from settings
    const settings = await storage.getSettings();
    const maxFileSizeSetting = settings.find(s => s.key === "system.maxFileSize");
    const maxLinesPerFile = maxFileSizeSetting ? parseInt(maxFileSizeSetting.value) : 100000;
    
    console.log(`[BLACKLIST] Max lines per file setting: ${maxLinesPerFile} (from value: ${maxFileSizeSetting?.value})`);

    // Ensure directories exist
    await ensureDirectories();

    // Generate files for each indicator type
    await generateIPFiles(maxLinesPerFile);
    await generateDomainFiles(maxLinesPerFile);
    await generateHashFiles(maxLinesPerFile);
    await generateURLFiles(maxLinesPerFile);
    
    // Generate proxy format files
    await generateProxyFiles();

    console.log("Blacklist files generated successfully");
  } catch (error) {
    console.error("Error generating blacklist files:", error);
    throw error;
  }
}

async function ensureDirectories(): Promise<void> {
  const dirs = ["IP", "Domain", "Hash", "URL", "Proxy"];
  
  for (const dir of dirs) {
    const dirPath = path.join(BLACKLIST_DIR, dir);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function generateIPFiles(maxLinesPerFile: number): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("ip");
  await writeIndicatorsToFiles(indicators, "IP", "BlackIP", maxLinesPerFile);
}

async function generateDomainFiles(maxLinesPerFile: number): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("domain");
  
  // Expand domains to include wildcard versions
  const expandedDomains = [];
  for (const indicator of indicators) {
    expandedDomains.push(indicator.value);
    expandedDomains.push(`*.${indicator.value}`);
  }
  
  await writeIndicatorsToFiles(
    expandedDomains.map(value => ({ value })),
    "Domain",
    "BlackDomain",
    maxLinesPerFile
  );
}

async function generateHashFiles(maxLinesPerFile: number): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("hash");
  await writeIndicatorsToFiles(indicators, "Hash", "BlackHash", maxLinesPerFile);
}

async function generateURLFiles(maxLinesPerFile: number): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("url");
  await writeIndicatorsToFiles(indicators, "URL", "BlackURL", maxLinesPerFile);
}

async function generateProxyFiles(): Promise<void> {
  const settings = await storage.getSettings();
  const domainCategory = settings.find(s => s.key === "proxyFormat.domainCategory")?.value || "blocked_domains";
  const urlCategory = settings.find(s => s.key === "proxyFormat.urlCategory")?.value || "blocked_urls";
  
  const domainIndicators = await storage.getActiveIndicatorsByType("domain");
  const urlIndicators = await storage.getActiveIndicatorsByType("url");
  const soarUrlIndicators = await storage.getActiveIndicatorsByType("soar-url");

  const proxyDir = path.join(BLACKLIST_DIR, "Proxy");
  
  // Clear existing proxy files
  try {
    const files = await fs.readdir(proxyDir);
    for (const file of files) {
      if (file.startsWith("proxy_") && file.endsWith(".txt")) {
        await fs.unlink(path.join(proxyDir, file));
      }
    }
  } catch (error) {
    // Directory might not exist or be empty
  }
  
  // Generate proxy format file
  let content = "";
  
  // Add domain category
  if (domainIndicators.length > 0 && domainCategory) {
    content += `define category ${domainCategory}\n`;
    for (const indicator of domainIndicators) {
      content += `  "${indicator.value}"\n`;
    }
    content += "end\n\n";
  }
  
  // Add URL category (includes both URL and SOAR-URL indicators)
  const allUrlIndicators = [...urlIndicators, ...soarUrlIndicators];
  if (allUrlIndicators.length > 0 && urlCategory) {
    content += `define category ${urlCategory}\n`;
    for (const indicator of allUrlIndicators) {
      content += `  "${indicator.value}"\n`;
    }
    content += "end\n\n";
  }
  
  // Write proxy file only if there's content
  if (content.trim()) {
    await fs.writeFile(path.join(proxyDir, "proxy_categories.txt"), content, "utf-8");
  }
}

async function writeIndicatorsToFiles(
  indicators: { value: string }[],
  type: string,
  prefix: string,
  maxLinesPerFile: number
): Promise<void> {
  const dir = path.join(BLACKLIST_DIR, type);
  
  // Clear existing files
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith(".txt")) {
        await fs.unlink(path.join(dir, file));
      }
    }
  } catch (error) {
    // Directory might not exist or be empty
  }

  if (indicators.length === 0) {
    return;
  }

  let fileIndex = 0;
  let currentFile: string[] = [];
  
  for (const indicator of indicators) {
    currentFile.push(indicator.value);
    
    if (currentFile.length >= maxLinesPerFile) {
      await writeFile(dir, `${prefix}${fileIndex}.txt`, currentFile);
      currentFile = [];
      fileIndex++;
    }
  }
  
  // Write remaining indicators
  if (currentFile.length > 0) {
    await writeFile(dir, `${prefix}${fileIndex}.txt`, currentFile);
  }
}

async function writeFile(dir: string, filename: string, lines: string[]): Promise<void> {
  const content = lines.join("\n") + "\n";
  await fs.writeFile(path.join(dir, filename), content, "utf-8");
}
