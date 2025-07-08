import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  role: text("role").notNull().default("reporter"), // admin, user, reporter
  authType: text("auth_type").notNull().default("local"), // local, ldap
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  indicatorTypes: text("indicator_types").array().notNull(), // array of: ip, domain, hash, url
  fetchInterval: integer("fetch_interval").notNull().default(3600), // seconds
  isActive: boolean("is_active").notNull().default(true),
  isPaused: boolean("is_paused").notNull().default(false),
  lastFetch: timestamp("last_fetch"),
  lastFetchStatus: text("last_fetch_status"), // success, error
  lastFetchError: text("last_fetch_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const indicators = pgTable("indicators", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  type: text("type").notNull(), // ip, domain, hash, url
  hashType: text("hash_type"), // md5, sha1, sha256, sha512 (for hash type only)
  source: text("source").notNull(),
  sourceId: integer("source_id").references(() => dataSources.id),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  tempActiveUntil: timestamp("temp_active_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const whitelist = pgTable("whitelist", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  type: text("type").notNull(), // ip, domain, hash, url
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull(), // info, warning, error
  action: text("action").notNull(), // create, update, delete, login, logout, fetch, blocked
  resource: text("resource").notNull(), // user, indicator, data_source, whitelist
  resourceId: text("resource_id"),
  details: text("details").notNull(),
  userId: integer("user_id").references(() => users.id),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indicatorNotes = pgTable("indicator_notes", {
  id: serial("id").primaryKey(),
  indicatorId: integer("indicator_id").notNull().references(() => indicators.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isEdited: boolean("is_edited").notNull().default(false),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whitelistBlocks = pgTable("whitelist_blocks", {
  id: serial("id").primaryKey(),
  value: text("value").notNull(),
  type: text("type").notNull(), // ip, domain, hash, url
  source: text("source").notNull(),
  sourceId: integer("source_id").references(() => dataSources.id),
  whitelistEntryId: integer("whitelist_entry_id").references(() => whitelist.id),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  blockedReason: text("blocked_reason"),
});

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  dataSources: many(dataSources),
  indicators: many(indicators),
  whitelistEntries: many(whitelist),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  indicatorNotes: many(indicatorNotes),
  apiTokens: many(apiTokens),
}));

export const dataSourcesRelations = relations(dataSources, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [dataSources.createdBy],
    references: [users.id],
  }),
  indicators: many(indicators),
}));

export const indicatorsRelations = relations(indicators, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [indicators.createdBy],
    references: [users.id],
  }),
  source: one(dataSources, {
    fields: [indicators.sourceId],
    references: [dataSources.id],
  }),
  notes: many(indicatorNotes),
}));

export const indicatorNotesRelations = relations(indicatorNotes, ({ one }) => ({
  indicator: one(indicators, {
    fields: [indicatorNotes.indicatorId],
    references: [indicators.id],
  }),
  user: one(users, {
    fields: [indicatorNotes.userId],
    references: [users.id],
  }),
}));

export const whitelistRelations = relations(whitelist, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [whitelist.createdBy],
    references: [users.id],
  }),
  blocks: many(whitelistBlocks),
}));

export const whitelistBlocksRelations = relations(whitelistBlocks, ({ one }) => ({
  source: one(dataSources, {
    fields: [whitelistBlocks.sourceId],
    references: [dataSources.id],
  }),
  whitelistEntry: one(whitelist, {
    fields: [whitelistBlocks.whitelistEntryId],
    references: [whitelist.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
  lastFetch: true,
  lastFetchStatus: true,
  lastFetchError: true,
});

export const insertIndicatorSchema = createInsertSchema(indicators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhitelistSchema = createInsertSchema(whitelist).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

export const insertIndicatorNoteSchema = createInsertSchema(indicatorNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
  editedAt: true,
});

export const insertWhitelistBlockSchema = createInsertSchema(whitelistBlocks).omit({
  id: true,
  attemptedAt: true,
});

export const insertApiTokenSchema = createInsertSchema(apiTokens).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DataSource = typeof dataSources.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type Indicator = typeof indicators.$inferSelect;
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type WhitelistEntry = typeof whitelist.$inferSelect;
export type InsertWhitelistEntry = z.infer<typeof insertWhitelistSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type IndicatorNote = typeof indicatorNotes.$inferSelect;
export type InsertIndicatorNote = z.infer<typeof insertIndicatorNoteSchema>;
export type WhitelistBlock = typeof whitelistBlocks.$inferSelect;
export type InsertWhitelistBlock = z.infer<typeof insertWhitelistBlockSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
