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
  lastFetch: timestamp("last_fetch"),
  lastFetchStatus: text("last_fetch_status"), // success, error
  lastFetchError: text("last_fetch_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const indicators = pgTable("indicators", {
  id: serial("id").primaryKey(),
  value: text("value").notNull(),
  type: text("type").notNull(), // ip, domain, hash, url
  hashType: text("hash_type"), // md5, sha1, sha256, sha512 (for hash type only)
  source: text("source").notNull(),
  sourceId: integer("source_id").references(() => dataSources.id),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  dataSources: many(dataSources),
  indicators: many(indicators),
  whitelistEntries: many(whitelist),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
}));

export const dataSourcesRelations = relations(dataSources, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [dataSources.createdBy],
    references: [users.id],
  }),
  indicators: many(indicators),
}));

export const indicatorsRelations = relations(indicators, ({ one }) => ({
  createdBy: one(users, {
    fields: [indicators.createdBy],
    references: [users.id],
  }),
  source: one(dataSources, {
    fields: [indicators.sourceId],
    references: [dataSources.id],
  }),
}));

export const whitelistRelations = relations(whitelist, ({ one }) => ({
  createdBy: one(users, {
    fields: [whitelist.createdBy],
    references: [users.id],
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
