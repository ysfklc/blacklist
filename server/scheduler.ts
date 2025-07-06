import cron from "node-cron";
import { storage } from "./storage";
import { fetchAndParseData } from "./fetcher";
import { generateBlacklistFiles } from "./blacklistGenerator";

export function initializeScheduler() {
  // Fetch data from sources every minute (checks intervals)
  cron.schedule("* * * * *", async () => {
    try {
      const dataSources = await storage.getActiveDataSources();
      
      for (const source of dataSources) {
        // Skip paused data sources
        if (source.isPaused) {
          continue;
        }

        const now = new Date();
        const lastFetch = source.lastFetch ? new Date(source.lastFetch) : new Date(0);
        const timeSinceLastFetch = (now.getTime() - lastFetch.getTime()) / 1000;
        
        if (timeSinceLastFetch >= source.fetchInterval) {
          console.log(`[SCHEDULER] Triggering fetch for source: ${source.name}`);
          
          // Don't await - let the fetch run in background
          fetchAndParseData(source).catch(error => {
            console.error(`[SCHEDULER] Error in background fetch for ${source.name}:`, error);
          });
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
