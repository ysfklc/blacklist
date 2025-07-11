import { 
  users, 
  dataSources, 
  indicators, 
  whitelist, 
  whitelistBlocks,
  auditLogs, 
  settings,
  sessions,
  indicatorNotes,
  apiTokens,
  type User, 
  type InsertUser,
  type DataSource,
  type InsertDataSource,
  type Indicator,
  type InsertIndicator,
  type WhitelistEntry,
  type InsertWhitelistEntry,
  type WhitelistBlock,
  type InsertWhitelistBlock,
  type AuditLog,
  type InsertAuditLog,
  type Setting,
  type InsertSetting,
  type IndicatorNote,
  type InsertIndicatorNote,
  type ApiToken,
  type InsertApiToken
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc, count, sql, inArray, isNotNull } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import CIDR from "ip-cidr";
import { encrypt, decrypt, shouldEncrypt } from "./encryption";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;

  // Data source operations
  getDataSources(): Promise<DataSource[]>;
  getActiveDataSources(): Promise<DataSource[]>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, data: Partial<DataSource>): Promise<DataSource>;
  deleteDataSource(id: number): Promise<void>;
  updateDataSourceStatus(id: number, status: string, error: string | null): Promise<void>;
  pauseDataSource(id: number): Promise<void>;
  resumeDataSource(id: number): Promise<void>;

  // Indicator operations
  getIndicators(page: number, limit: number, filters: any): Promise<any>;
  createIndicator(indicator: InsertIndicator): Promise<Indicator>;
  getIndicatorByValue(value: string): Promise<Indicator | undefined>;
  getIndicatorByValueCaseInsensitive(value: string): Promise<Indicator | undefined>;
  createOrUpdateIndicator(indicator: Partial<InsertIndicator>): Promise<Indicator>;
  bulkCreateOrUpdateIndicators(indicators: Partial<InsertIndicator>[]): Promise<number>;
  updateIndicator(id: number, data: Partial<Indicator>): Promise<Indicator>;
  deleteIndicator(id: number): Promise<void>;
  tempActivateIndicator(id: number, durationHours: number, userId: number): Promise<Indicator>;
  deleteExpiredTempIndicators(): Promise<number>;
  isWhitelisted(value: string, type: string): Promise<boolean>;
  bulkCheckWhitelist(values: string[], type: string): Promise<Set<string>>;
  getDistinctIndicatorSources(): Promise<any[]>;
  getActiveIndicatorsByType(type: string): Promise<{ value: string }[]>;

  // Whitelist operations
  getWhitelist(): Promise<any[]>;
  createWhitelistEntry(entry: InsertWhitelistEntry): Promise<WhitelistEntry>;
  deleteWhitelistEntry(id: number): Promise<void>;
  deleteIndicatorsFromWhitelist(value: string, type: string): Promise<number>;
  
  // Whitelist blocks operations
  getWhitelistBlocks(page: number, limit: number): Promise<any>;
  createWhitelistBlock(block: InsertWhitelistBlock): Promise<WhitelistBlock>;
  recordWhitelistBlock(value: string, type: string, source: string, sourceId?: number): Promise<void>;

  // Audit log operations
  getAuditLogs(page: number, limit: number, filters: any): Promise<any>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Settings operations
  getSettings(): Promise<Setting[]>;
  updateSettings(settingsData: Record<string, any>, userId: number): Promise<void>;

  // Public file stats
  getPublicFileStats(): Promise<any>;

  // Indicator notes operations
  getIndicatorNotes(indicatorId: number): Promise<any[]>;
  createIndicatorNote(note: InsertIndicatorNote): Promise<IndicatorNote>;
  updateIndicatorNote(id: number, content: string, userId: number): Promise<IndicatorNote>;
  deleteIndicatorNote(id: number, userId: number): Promise<void>;

  // API token operations
  getApiTokens(userId: number): Promise<ApiToken[]>;
  createApiToken(token: InsertApiToken): Promise<ApiToken>;
  deleteApiToken(id: number, userId: number): Promise<void>;
  updateApiTokenLastUsed(token: string): Promise<void>;
  getApiTokenByToken(token: string): Promise<ApiToken | undefined>;
  revokeApiToken(id: number, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    // First, update all foreign key references to null or handle them appropriately
    // Update indicators created by this user to null
    await db.update(indicators)
      .set({ createdBy: null })
      .where(eq(indicators.createdBy, id));
    
    // Update data sources created by this user to null
    await db.update(dataSources)
      .set({ createdBy: null })
      .where(eq(dataSources.createdBy, id));
    
    // Update whitelist entries created by this user to null
    await db.update(whitelist)
      .set({ createdBy: null })
      .where(eq(whitelist.createdBy, id));
    
    // Delete indicator notes created by this user
    await db.delete(indicatorNotes)
      .where(eq(indicatorNotes.userId, id));
    
    // Delete audit logs for this user
    await db.delete(auditLogs)
      .where(eq(auditLogs.userId, id));
    
    // Delete sessions for this user
    await db.delete(sessions)
      .where(eq(sessions.userId, id));
    
    // Finally, delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async getDashboardStats(): Promise<any> {
    const [totalIndicators] = await db.select({ count: count() }).from(indicators);
    const [activeIndicators] = await db.select({ count: count() }).from(indicators).where(eq(indicators.isActive, true));
    const [totalDataSources] = await db.select({ count: count() }).from(dataSources);
    
    const indicatorsByType = await db
      .select({
        type: indicators.type,
        count: count()
      })
      .from(indicators)
      .where(eq(indicators.isActive, true))
      .groupBy(indicators.type);

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    const dataSourcesStatus = await db
      .select({
        id: dataSources.id,
        name: dataSources.name,
        indicatorTypes: dataSources.indicatorTypes,
        lastFetchStatus: dataSources.lastFetchStatus,
        lastFetch: dataSources.lastFetch,
        fetchInterval: dataSources.fetchInterval,
      })
      .from(dataSources)
      .where(eq(dataSources.isActive, true))
      .limit(10);

    const indicatorTypeMap = indicatorsByType.reduce((acc, item) => {
      acc[item.type] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIndicators: totalIndicators.count,
      activeIndicators: activeIndicators.count,
      dataSources: totalDataSources.count,
      lastUpdate: "2 min ago",
      indicatorsByType: {
        ip: indicatorTypeMap.ip || 0,
        domain: indicatorTypeMap.domain || 0,
        hash: indicatorTypeMap.hash || 0,
        url: indicatorTypeMap.url || 0,
        "soar-url": indicatorTypeMap["soar-url"] || 0,
      },
      recentActivity: recentActivity.map(log => ({
        id: log.id,
        level: log.level,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
      })),
      dataSourcesStatus: dataSourcesStatus.map(source => ({
        id: source.id,
        name: source.name,
        type: source.indicatorTypes ? source.indicatorTypes.join(', ') : 'unknown',
        status: source.lastFetchStatus || 'pending',
        lastFetch: source.lastFetch ? new Date(source.lastFetch).toLocaleString() : 'Never',
        nextFetch: source.lastFetch ? 
          `In ${Math.max(0, Math.floor((source.fetchInterval - (Date.now() - new Date(source.lastFetch).getTime()) / 1000) / 60))} minutes` : 
          'Pending',
      })),
    };
  }

  async getDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources).orderBy(desc(dataSources.createdAt));
  }

  async getActiveDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources).where(eq(dataSources.isActive, true));
  }

  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> {
    const [source] = await db
      .insert(dataSources)
      .values(dataSource)
      .returning();
    return source;
  }

  async updateDataSource(id: number, data: Partial<DataSource>): Promise<DataSource> {
    const [source] = await db
      .update(dataSources)
      .set(data)
      .where(eq(dataSources.id, id))
      .returning();
    return source;
  }

  async deleteDataSource(id: number): Promise<void> {
    await db.delete(dataSources).where(eq(dataSources.id, id));
  }

  async updateDataSourceStatus(id: number, status: string, error: string | null): Promise<void> {
    await db
      .update(dataSources)
      .set({
        lastFetchStatus: status,
        lastFetchError: error,
        lastFetch: new Date(),
      })
      .where(eq(dataSources.id, id));
  }

  async pauseDataSource(id: number): Promise<void> {
    await db
      .update(dataSources)
      .set({ isPaused: true })
      .where(eq(dataSources.id, id));
  }

  async resumeDataSource(id: number): Promise<void> {
    await db
      .update(dataSources)
      .set({ isPaused: false })
      .where(eq(dataSources.id, id));
  }

  async getIndicators(page: number, limit: number, filters: any): Promise<any> {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (filters.type) {
      conditions.push(eq(indicators.type, filters.type));
    }
    if (filters.status === 'active') {
      conditions.push(eq(indicators.isActive, true));
    } else if (filters.status === 'passive') {
      conditions.push(eq(indicators.isActive, false));
    }
    if (filters.source) {
      conditions.push(eq(indicators.source, filters.source));
    }
    if (filters.search) {
      conditions.push(ilike(indicators.value, `%${filters.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCount] = await db
      .select({ count: count() })
      .from(indicators)
      .where(whereClause);

    const data = await db
      .select({
        id: indicators.id,
        value: indicators.value,
        type: indicators.type,
        hashType: indicators.hashType,
        source: indicators.source,
        sourceId: indicators.sourceId,
        isActive: indicators.isActive,
        tempActiveUntil: indicators.tempActiveUntil,
        createdAt: indicators.createdAt,
        updatedAt: indicators.updatedAt,
        createdBy: indicators.createdBy,
        createdByUser: users.username,
        notesCount: sql<number>`(
          SELECT COALESCE(COUNT(*), 0)::integer
          FROM ${indicatorNotes}
          WHERE ${indicatorNotes.indicatorId} = ${indicators.id}
        )`.as('notesCount'),
      })
      .from(indicators)
      .leftJoin(users, eq(indicators.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(indicators.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        start: offset + 1,
        end: Math.min(offset + limit, totalCount.count),
        hasNext: offset + limit < totalCount.count,
      },
    };
  }

  async createIndicator(indicator: InsertIndicator): Promise<Indicator> {
    const [created] = await db
      .insert(indicators)
      .values(indicator)
      .returning();
    return created;
  }

  async getIndicatorByValue(value: string): Promise<Indicator | undefined> {
    const [result] = await db
      .select()
      .from(indicators)
      .where(eq(indicators.value, value))
      .limit(1);
    return result;
  }

  async getIndicatorByValueCaseInsensitive(value: string): Promise<Indicator | undefined> {
    const [result] = await db
      .select()
      .from(indicators)
      .where(sql`LOWER(${indicators.value}) = LOWER(${value})`)
      .limit(1);
    return result;
  }

  async createOrUpdateIndicator(indicator: Partial<InsertIndicator>): Promise<Indicator> {
    if (!indicator.value || !indicator.type) {
      throw new Error("Value and type are required");
    }

    const existing = await db
      .select()
      .from(indicators)
      .where(and(
        eq(indicators.value, indicator.value),
        eq(indicators.type, indicator.type)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Only update source info, not the updated_at timestamp for existing indicators
      const [updated] = await db
        .update(indicators)
        .set({
          source: indicator.source || existing[0].source,
          sourceId: indicator.sourceId || existing[0].sourceId,
        })
        .where(eq(indicators.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(indicators)
        .values({
          value: indicator.value,
          type: indicator.type,
          hashType: indicator.hashType,
          source: indicator.source || 'unknown',
          sourceId: indicator.sourceId,
          isActive: indicator.isActive ?? true,
          createdBy: indicator.createdBy,
        })
        .returning();
      return created;
    }
  }

  async bulkCreateOrUpdateIndicators(indicatorsData: Partial<InsertIndicator>[]): Promise<number> {
    if (indicatorsData.length === 0) return 0;

    // Deduplicate within the batch to avoid unnecessary work
    const uniqueIndicators = new Map<string, Partial<InsertIndicator>>();
    
    for (const indicator of indicatorsData) {
      const key = `${indicator.value}:${indicator.type}`;
      if (!uniqueIndicators.has(key)) {
        uniqueIndicators.set(key, indicator);
      }
    }

    const values = Array.from(uniqueIndicators.values()).map(indicator => ({
      value: indicator.value!,
      type: indicator.type!,
      hashType: indicator.hashType,
      source: indicator.source || 'unknown',
      sourceId: indicator.sourceId,
      isActive: indicator.isActive ?? true,
      notes: indicator.notes,
      createdBy: indicator.createdBy || 1,
    }));

    try {
      // Use PostgreSQL's UPSERT with a unique index
      // First create the unique index if it doesn't exist
      await db.execute(sql`
        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS indicators_value_type_idx 
        ON indicators (value, type)
      `).catch(() => {
        // Index might already exist, that's fine
      });

      // Now use ON CONFLICT with the index
      const result = await db.insert(indicators)
        .values(values)
        .onConflictDoUpdate({
          target: [indicators.value, indicators.type],
          set: {
            // Only update source info, not the updated_at timestamp for existing indicators
            source: sql`EXCLUDED.source`,
            sourceId: sql`EXCLUDED.source_id`,
          },
        });
      
      return values.length;
    } catch (error) {
      console.error('Bulk upsert with index failed:', error);
      
      // Fallback: Use a simple approach that deduplicates on the application side
      try {
        // Get all existing values for this batch
        const existingValues = values.map(v => v.value);
        const existingTypes = values.map(v => v.type);
        
        const existing = await db
          .select({ value: indicators.value, type: indicators.type })
          .from(indicators)
          .where(
            sql`(value, type) IN (${sql.join(
              values.map(v => sql`(${v.value}, ${v.type})`),
              sql`, `
            )})`
          );

        const existingSet = new Set(existing.map(item => `${item.value}:${item.type}`));
        
        // Only insert truly new indicators
        const newIndicators = values.filter(v => !existingSet.has(`${v.value}:${v.type}`));
        
        if (newIndicators.length > 0) {
          await db.insert(indicators).values(newIndicators);
        }
        
        // Skip updating existing indicators to avoid performance issues
        // Only update updated_at when indicators are actually modified (active/inactive changes)
        
        return values.length;
      } catch (fallbackError) {
        console.error('Fallback approach failed:', fallbackError);
        
        // Last resort: just insert and ignore conflicts
        await db.insert(indicators).values(values).onConflictDoNothing();
        return values.length;
      }
    }
  }

  async bulkCheckWhitelist(values: string[], type: string): Promise<Set<string>> {
    if (values.length === 0) return new Set();

    // Get all whitelist entries for the type
    const whitelistEntries = await db
      .select({ value: whitelist.value })
      .from(whitelist)
      .where(eq(whitelist.type, type));

    const whitelistValues = whitelistEntries.map(e => e.value);
    const whitelistedSet = new Set<string>();

    // For IP addresses, check both exact matches and CIDR ranges
    if (type === 'ip') {
      for (const value of values) {
        if (this.isIpWhitelisted(value, whitelistValues)) {
          whitelistedSet.add(value);
        }
      }
    } else {
      // For other types, use exact matching (original logic)
      const exactMatches = await db
        .select({ value: whitelist.value })
        .from(whitelist)
        .where(and(
          inArray(whitelist.value, values),
          eq(whitelist.type, type)
        ));
      
      exactMatches.forEach(item => whitelistedSet.add(item.value));
    }

    return whitelistedSet;
  }

  async getDistinctIndicatorSources(): Promise<any[]> {
    // Get distinct sources from indicators with user information for manual entries
    const sources = await db
      .selectDistinct({
        source: indicators.source,
        createdByUser: users.username,
      })
      .from(indicators)
      .leftJoin(users, eq(indicators.createdBy, users.id))
      .where(sql`${indicators.source} IS NOT NULL`)
      .orderBy(indicators.source);

    return sources.map(s => ({
      value: s.source,
      label: s.source === 'manual' ? (s.createdByUser || 'Manual Entry') : s.source
    }));
  }

  async updateIndicator(id: number, data: Partial<Indicator>): Promise<Indicator> {
    const [updated] = await db
      .update(indicators)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(indicators.id, id))
      .returning();
    return updated;
  }

  async deleteIndicator(id: number): Promise<void> {
    await db.delete(indicators).where(eq(indicators.id, id));
  }

  async tempActivateIndicator(id: number, durationHours: number, userId: number): Promise<Indicator> {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + durationHours);
    
    const [updated] = await db
      .update(indicators)
      .set({ 
        isActive: true, 
        tempActiveUntil: expirationTime,
        updatedAt: new Date()
      })
      .where(eq(indicators.id, id))
      .returning();
    
    // Create audit log
    await this.createAuditLog({
      level: 'info',
      action: 'temp_activate',
      resource: 'indicator',
      resourceId: id.toString(),
      details: `Temporarily activated indicator for ${durationHours} hours until ${expirationTime.toISOString()}`,
      userId: userId
    });
    
    return updated;
  }

  async deleteExpiredTempIndicators(): Promise<number> {
    const now = new Date();
    
    try {
      // Get expired indicators before deleting them
      const expiredIndicators = await db
        .select({ id: indicators.id, value: indicators.value })
        .from(indicators)
        .where(
          and(
            eq(indicators.isActive, true),
            isNotNull(indicators.tempActiveUntil),
            sql`${indicators.tempActiveUntil} <= ${now}`
          )
        );
      
      // Delete expired indicators
      const result = await db
        .delete(indicators)
        .where(
          and(
            eq(indicators.isActive, true),
            isNotNull(indicators.tempActiveUntil),
            sql`${indicators.tempActiveUntil} <= ${now}`
          )
        )
        .returning({ id: indicators.id });
      
      // Create audit logs for each deleted indicator
      for (const indicator of expiredIndicators) {
        await this.createAuditLog({
          level: 'info',
          action: 'temp_delete',
          resource: 'indicator',
          resourceId: indicator.id.toString(),
          details: `Automatically deleted expired temporary indicator: ${indicator.value}`,
          userId: 1 // System user
        });
      }
      
      return result.length;
    } catch (error) {
      console.error('Error deleting expired temp indicators:', error);
      return 0;
    }
  }

  async isWhitelisted(value: string, type: string): Promise<boolean> {
    // Get all whitelist entries for the type
    const whitelistEntries = await db
      .select({ value: whitelist.value })
      .from(whitelist)
      .where(eq(whitelist.type, type));
    
    // For IP addresses, check both exact matches and CIDR ranges
    if (type === 'ip') {
      return this.isIpWhitelisted(value, whitelistEntries.map(e => e.value));
    }
    
    // For other types, use exact matching
    return whitelistEntries.some(entry => entry.value === value);
  }

  private isIpWhitelisted(ipAddress: string, whitelistValues: string[]): boolean {
    for (const whitelistValue of whitelistValues) {
      // Check for exact match first
      if (whitelistValue === ipAddress) {
        return true;
      }
      
      // Check if whitelist value is a CIDR range
      if (whitelistValue.includes('/')) {
        try {
          const cidr = new CIDR(whitelistValue);
          if (cidr.contains(ipAddress)) {
            return true;
          }
        } catch (error) {
          // Invalid CIDR format, skip this entry
          console.warn(`Invalid CIDR format in whitelist: ${whitelistValue}`);
          continue;
        }
      }
    }
    
    return false;
  }

  async getActiveIndicatorsByType(type: string): Promise<{ value: string }[]> {
    return await db
      .select({ value: indicators.value })
      .from(indicators)
      .where(and(
        eq(indicators.type, type),
        eq(indicators.isActive, true)
      ));
  }

  async getWhitelist(): Promise<any[]> {
    return await db
      .select({
        id: whitelist.id,
        value: whitelist.value,
        type: whitelist.type,
        reason: whitelist.reason,
        createdAt: whitelist.createdAt,
        createdBy: {
          username: users.username
        }
      })
      .from(whitelist)
      .leftJoin(users, eq(whitelist.createdBy, users.id))
      .orderBy(desc(whitelist.createdAt));
  }

  async createWhitelistEntry(entry: InsertWhitelistEntry): Promise<WhitelistEntry> {
    const [created] = await db
      .insert(whitelist)
      .values(entry)
      .returning();
    
    return created;
  }

  async deleteWhitelistEntry(id: number): Promise<void> {
    await db.delete(whitelist).where(eq(whitelist.id, id));
  }

  async deleteIndicatorsFromWhitelist(value: string, type: string): Promise<number> {
    let deletedCount = 0;

    if (type === 'ip' && value.includes('/')) {
      // Handle CIDR range deletion
      try {
        const cidr = new CIDR(value);
        
        // Get all IP indicators (both active and inactive)
        const allIps = await db
          .select({ id: indicators.id, value: indicators.value })
          .from(indicators)
          .where(eq(indicators.type, 'ip'));

        // Find IPs that fall within the CIDR range
        const ipsToDelete = allIps.filter(ip => {
          try {
            return cidr.contains(ip.value);
          } catch {
            return false; // Skip invalid IPs
          }
        });

        if (ipsToDelete.length > 0) {
          const idsToDelete = ipsToDelete.map(ip => ip.id);
          
          // Delete indicators
          await db
            .delete(indicators)
            .where(inArray(indicators.id, idsToDelete));

          deletedCount = ipsToDelete.length;
        }
      } catch (error) {
        console.warn(`Invalid CIDR format: ${value}`);
      }
    } else {
      // Handle exact match deletion
      const result = await db
        .delete(indicators)
        .where(and(
          eq(indicators.value, value),
          eq(indicators.type, type)
        ))
        .returning({ id: indicators.id });

      deletedCount = result.length;
    }

    return deletedCount;
  }

  async getAuditLogs(page: number, limit: number, filters: any): Promise<any> {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (filters.level) {
      conditions.push(eq(auditLogs.level, filters.level));
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.user) {
      conditions.push(eq(users.username, filters.user));
    }
    if (filters.startDate) {
      conditions.push(sql`${auditLogs.createdAt} >= ${new Date(filters.startDate)}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${new Date(filters.endDate)}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCount] = await db
      .select({ count: count() })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause);

    const data = await db
      .select({
        id: auditLogs.id,
        level: auditLogs.level,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        user: users.username,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        start: offset + 1,
        end: Math.min(offset + limit, totalCount.count),
        hasNext: offset + limit < totalCount.count,
      },
    };
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return created;
  }

  async getSettings(): Promise<Setting[]> {
    const allSettings = await db.select().from(settings);
    
    // Decrypt sensitive values before returning
    return allSettings.map(setting => ({
      ...setting,
      value: setting.encrypted ? decrypt(setting.value) : setting.value
    }));
  }

  async updateSettings(settingsData: Record<string, any>, userId: number): Promise<void> {
    for (const [key, value] of Object.entries(settingsData)) {
      try {
        const existing = await db
          .select()
          .from(settings)
          .where(eq(settings.key, key))
          .limit(1);

        const isEncrypted = shouldEncrypt(key);
        const valueToStore = isEncrypted ? encrypt(String(value)) : String(value);

        if (existing.length > 0) {
          await db
            .update(settings)
            .set({
              value: valueToStore,
              encrypted: isEncrypted,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(settings.key, key));
        } else {
          await db
            .insert(settings)
            .values({
              key,
              value: valueToStore,
              encrypted: isEncrypted,
              updatedBy: userId,
            });
        }
      } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        throw error;
      }
    }
  }

  async getPublicFileStats(): Promise<any> {
    
    const [ipCount] = await db.select({ count: count() }).from(indicators).where(and(eq(indicators.type, 'ip'), eq(indicators.isActive, true)));
    const [domainCount] = await db.select({ count: count() }).from(indicators).where(and(eq(indicators.type, 'domain'), eq(indicators.isActive, true)));
    const [hashCount] = await db.select({ count: count() }).from(indicators).where(and(eq(indicators.type, 'hash'), eq(indicators.isActive, true)));
    const [urlCount] = await db.select({ count: count() }).from(indicators).where(and(eq(indicators.type, 'url'), eq(indicators.isActive, true)));

    // Count actual files in each directory
    const countFiles = (directory: string) => {
      try {
        const dirPath = path.join('./public/blacklist', directory);
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath).filter((file: string) => file.endsWith('.txt'));
          return files.length;
        }
        return 0;
      } catch (error) {
        console.error(`Error counting files in ${directory}:`, error);
        return 0;
      }
    };

    return {
      ip: {
        count: countFiles('IP'),
        totalCount: ipCount.count.toLocaleString(),
        lastUpdate: "2 min ago",
      },
      domain: {
        count: countFiles('Domain'),
        totalCount: domainCount.count.toLocaleString(),
        lastUpdate: "2 min ago",
      },
      hash: {
        count: countFiles('Hash'),
        totalCount: hashCount.count.toLocaleString(),
        lastUpdate: "2 min ago",
      },
      url: {
        count: countFiles('URL'),
        totalCount: urlCount.count.toLocaleString(),
        lastUpdate: "2 min ago",
      },
    };
  }

  // Indicator notes operations
  async getIndicatorNotes(indicatorId: number): Promise<any[]> {
    const notes = await db
      .select({
        id: indicatorNotes.id,
        content: indicatorNotes.content,
        isEdited: indicatorNotes.isEdited,
        editedAt: indicatorNotes.editedAt,
        createdAt: indicatorNotes.createdAt,
        updatedAt: indicatorNotes.updatedAt,
        user: {
          id: users.id,
          username: users.username,
        },
      })
      .from(indicatorNotes)
      .leftJoin(users, eq(indicatorNotes.userId, users.id))
      .where(eq(indicatorNotes.indicatorId, indicatorId))
      .orderBy(desc(indicatorNotes.createdAt));

    return notes;
  }

  async createIndicatorNote(note: InsertIndicatorNote): Promise<IndicatorNote> {
    const [newNote] = await db
      .insert(indicatorNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async updateIndicatorNote(id: number, content: string, userId: number): Promise<IndicatorNote> {
    // First check if the user owns this note
    const [existingNote] = await db
      .select()
      .from(indicatorNotes)
      .where(and(eq(indicatorNotes.id, id), eq(indicatorNotes.userId, userId)));

    if (!existingNote) {
      throw new Error("Note not found or access denied");
    }

    const [updatedNote] = await db
      .update(indicatorNotes)
      .set({
        content,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(indicatorNotes.id, id))
      .returning();

    return updatedNote;
  }

  async deleteIndicatorNote(id: number, userId: number): Promise<void> {
    // First check if the user owns this note
    const [existingNote] = await db
      .select()
      .from(indicatorNotes)
      .where(and(eq(indicatorNotes.id, id), eq(indicatorNotes.userId, userId)));

    if (!existingNote) {
      throw new Error("Note not found or access denied");
    }

    await db
      .delete(indicatorNotes)
      .where(eq(indicatorNotes.id, id));
  }

  async getWhitelistBlocks(page: number, limit: number): Promise<any> {
    const offset = (page - 1) * limit;
    
    const [totalCount] = await db
      .select({ count: count() })
      .from(whitelistBlocks);

    const data = await db
      .select({
        id: whitelistBlocks.id,
        value: whitelistBlocks.value,
        type: whitelistBlocks.type,
        source: whitelistBlocks.source,
        attemptedAt: whitelistBlocks.attemptedAt,
        blockedReason: whitelistBlocks.blockedReason,
        sourceName: dataSources.name,
        whitelistValue: whitelist.value,
      })
      .from(whitelistBlocks)
      .leftJoin(dataSources, eq(whitelistBlocks.sourceId, dataSources.id))
      .leftJoin(whitelist, eq(whitelistBlocks.whitelistEntryId, whitelist.id))
      .orderBy(desc(whitelistBlocks.attemptedAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        start: offset + 1,
        end: Math.min(offset + limit, totalCount.count),
        hasNext: offset + limit < totalCount.count,
      },
    };
  }

  async createWhitelistBlock(block: InsertWhitelistBlock): Promise<WhitelistBlock> {
    const [created] = await db
      .insert(whitelistBlocks)
      .values(block)
      .returning();
    return created;
  }

  async recordWhitelistBlock(value: string, type: string, source: string, sourceId?: number): Promise<void> {
    // Find the whitelist entry that blocked this indicator
    let whitelistEntryId: number | undefined;
    
    if (type === 'ip' && await this.isWhitelisted(value, type)) {
      // For IP addresses, find the matching whitelist entry (including CIDR ranges)
      const whitelistEntries = await db
        .select({ id: whitelist.id, value: whitelist.value })
        .from(whitelist)
        .where(eq(whitelist.type, 'ip'));

      for (const entry of whitelistEntries) {
        if (entry.value === value) {
          whitelistEntryId = entry.id;
          break;
        }
        
        if (entry.value.includes('/')) {
          try {
            const cidr = new CIDR(entry.value);
            if (cidr.contains(value)) {
              whitelistEntryId = entry.id;
              break;
            }
          } catch {
            // Skip invalid CIDR entries
          }
        }
      }
    } else {
      // For other types, find exact match
      const [entry] = await db
        .select({ id: whitelist.id })
        .from(whitelist)
        .where(and(
          eq(whitelist.value, value),
          eq(whitelist.type, type)
        ));
      whitelistEntryId = entry?.id;
    }

    await this.createWhitelistBlock({
      value,
      type,
      source,
      sourceId,
      whitelistEntryId,
      blockedReason: `Blocked by whitelist entry during feed processing`,
    });
  }

  // API token operations
  async getApiTokens(userId: number): Promise<ApiToken[]> {
    return await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));
  }

  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const [created] = await db
      .insert(apiTokens)
      .values(token)
      .returning();
    return created;
  }

  async deleteApiToken(id: number, userId: number): Promise<void> {
    await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
  }

  async updateApiTokenLastUsed(token: string): Promise<void> {
    await db
      .update(apiTokens)
      .set({ lastUsed: new Date() })
      .where(eq(apiTokens.token, token));
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const [apiToken] = await db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.token, token), eq(apiTokens.isActive, true)));
    return apiToken || undefined;
  }

  async revokeApiToken(id: number, userId: number): Promise<void> {
    await db
      .update(apiTokens)
      .set({ isActive: false })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
