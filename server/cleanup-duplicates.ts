import { db } from "./db";
import { indicators } from "@shared/schema";
import { sql } from "drizzle-orm";

async function cleanupDuplicates() {
  console.log("Starting duplicate cleanup...");
  
  try {
    // Get count of duplicates
    const duplicateCount = await db.execute(sql`
      SELECT COUNT(*) - COUNT(DISTINCT (value, type)) as duplicate_count
      FROM indicators
    `);
    
    console.log(`Found ${(duplicateCount.rows[0] as any).duplicate_count} duplicate indicators`);
    
    if ((duplicateCount.rows[0] as any).duplicate_count > 0) {
      // Delete duplicates keeping only the oldest record for each (value, type) combination
      // Process in batches to avoid timeouts
      let totalDeleted = 0;
      let batchSize = 1000;
      
      while (true) {
        const result = await db.execute(sql`
          DELETE FROM indicators 
          WHERE id IN (
            SELECT id FROM (
              SELECT id, 
                     ROW_NUMBER() OVER (PARTITION BY value, type ORDER BY created_at ASC) as rn
              FROM indicators 
              LIMIT ${batchSize}
            ) t 
            WHERE t.rn > 1
          )
        `);
        
        const deletedCount = result.rowCount || 0;
        totalDeleted += deletedCount;
        
        console.log(`Deleted ${deletedCount} duplicates (total: ${totalDeleted})`);
        
        if (deletedCount === 0) break;
      }
      
      console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);
    }
    
    // Now add the unique constraint
    try {
      await db.execute(sql`
        ALTER TABLE indicators ADD CONSTRAINT indicators_value_type_unique UNIQUE (value, type)
      `);
      console.log("Added unique constraint on (value, type)");
    } catch (error) {
      console.log("Unique constraint already exists or couldn't be added:", error);
    }
    
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Run cleanup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicates().then(() => {
    console.log("Cleanup completed");
    process.exit(0);
  }).catch(error => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
}

export { cleanupDuplicates };