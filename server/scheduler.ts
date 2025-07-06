import cron from "node-cron";
import { storage } from "./storage";
import { fetchAndParseData } from "./fetcher";
import { generateBlacklistFiles } from "./blacklistGenerator";

let fetchInProgress = new Set<number>();

export function initializeScheduler() {
  // Fetch data from sources every minute (checks intervals)
  cron.schedule("* * * * *", async () => {
    try {
      const dataSources = await storage.getActiveDataSources();
      
      for (const source of dataSources) {
        // Skip if fetch is already in progress for this source
        if (fetchInProgress.has(source.id)) {
          console.log(`[SCHEDULER] Skipping ${source.name} - fetch already in progress`);
          continue;
        }
        
        const now = new Date();
        const lastFetch = source.lastFetch ? new Date(source.lastFetch) : new Date(0);
        const timeSinceLastFetch = (now.getTime() - lastFetch.getTime()) / 1000;
        
        if (timeSinceLastFetch >= source.fetchInterval) {
          console.log(`Fetching from source: ${source.name}`);
          fetchInProgress.add(source.id);
          
          try {
            await fetchAndParseData(source);
          } finally {
            fetchInProgress.delete(source.id);
          }
        }
      }
    } catch (error) {
      console.error("Error in data fetching scheduler:", error);
    }
  });

  // Generate blacklist files every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("Generating blacklist files...");
      await generateBlacklistFiles();
    } catch (error) {
      console.error("Error generating blacklist files:", error);
    }
  });

  console.log("Schedulers initialized");
}
