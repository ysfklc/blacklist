import cron from "node-cron";
import { storage } from "./storage";
import { fetchAndParseData } from "./fetcher";
import { generateBlacklistFiles } from "./blacklistGenerator";

let lastBlacklistGeneration = 0;

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

  // Check for blacklist generation every 10 seconds (configurable interval)
  cron.schedule("*/10 * * * * *", async () => {
    try {
      const settings = await storage.getSettings();
      const blacklistIntervalSetting = settings.find(s => s.key === "system.blacklistUpdateInterval");
      const blacklistInterval = blacklistIntervalSetting ? parseInt(blacklistIntervalSetting.value) : 300; // default 5 minutes (300 seconds)
      
      const now = Date.now();
      const timeSinceLastGeneration = (now - lastBlacklistGeneration) / 1000;
      
      if (timeSinceLastGeneration >= blacklistInterval) {
        console.log("Generating blacklist files...");
        await generateBlacklistFiles();
        lastBlacklistGeneration = now;
      }
    } catch (error) {
      console.error("Error generating blacklist files:", error);
    }
  });

  console.log("Schedulers initialized");
}
