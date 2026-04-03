import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medications = pgTable("medications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosageAmount: text("dosage_amount").notNull().default("1"),
  dosageUnit: text("dosage_unit").notNull().default("tablet"),
  customUnit: text("custom_unit"),
  memo: text("memo"),
  color: text("color").notNull().default("#3B82F6"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medicationTimes = pgTable("medication_times", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  medicationId: varchar("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  time: text("time").notNull(),
  label: text("label"),
  mealTiming: text("meal_timing"),
});

export const doseLogs = pgTable("dose_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationId: varchar("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  scheduledTime: text("scheduled_time").notNull(),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
  photoUri: text("photo_uri"),
  date: text("date").notNull(),
});

export const connections = pgTable("connections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetId: varchar("target_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  nickname: text("nickname"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
});

export const nudges = pgTable("nudges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: varchar("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  timezone: true,
});

export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true,
});

export const insertMedicationTimeSchema = createInsertSchema(medicationTimes).omit({
  id: true,
});

export const insertDoseLogSchema = createInsertSchema(doseLogs).omit({
  id: true,
  takenAt: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
});

export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type MedicationTime = typeof medicationTimes.$inferSelect;
export type DoseLog = typeof doseLogs.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type Nudge = typeof nudges.$inferSelect;
