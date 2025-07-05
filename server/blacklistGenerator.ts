import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";

const MAX_LINES_PER_FILE = 100000;
const BLACKLIST_DIR = path.join(process.cwd(), "public", "blacklist");

export async function generateBlacklistFiles(): Promise<void> {
  try {
    // Ensure directories exist
    await ensureDirectories();

    // Generate files for each indicator type
    await generateIPFiles();
    await generateDomainFiles();
    await generateHashFiles();
    await generateURLFiles();

    console.log("Blacklist files generated successfully");
  } catch (error) {
    console.error("Error generating blacklist files:", error);
    throw error;
  }
}

async function ensureDirectories(): Promise<void> {
  const dirs = ["IP", "Domain", "Hash", "URL"];
  
  for (const dir of dirs) {
    const dirPath = path.join(BLACKLIST_DIR, dir);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function generateIPFiles(): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("ip");
  await writeIndicatorsToFiles(indicators, "IP", "BlackIP");
}

async function generateDomainFiles(): Promise<void> {
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
    "BlackDomain"
  );
}

async function generateHashFiles(): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("hash");
  await writeIndicatorsToFiles(indicators, "Hash", "BlackHash");
}

async function generateURLFiles(): Promise<void> {
  const indicators = await storage.getActiveIndicatorsByType("url");
  await writeIndicatorsToFiles(indicators, "URL", "BlackURL");
}

async function writeIndicatorsToFiles(
  indicators: { value: string }[],
  type: string,
  prefix: string
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
    
    if (currentFile.length >= MAX_LINES_PER_FILE) {
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
