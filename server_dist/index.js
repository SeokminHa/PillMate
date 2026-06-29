var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt2 from "bcryptjs";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  connections: () => connections,
  doseLogs: () => doseLogs,
  groupMembers: () => groupMembers,
  groups: () => groups,
  insertConnectionSchema: () => insertConnectionSchema,
  insertDoseLogSchema: () => insertDoseLogSchema,
  insertInviteCodeSchema: () => insertInviteCodeSchema,
  insertMedicationSchema: () => insertMedicationSchema,
  insertMedicationTimeSchema: () => insertMedicationTimeSchema,
  insertUserSchema: () => insertUserSchema,
  inviteCodes: () => inviteCodes,
  medicationTimes: () => medicationTimes,
  medications: () => medications,
  nudges: () => nudges,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var medications = pgTable("medications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosageAmount: text("dosage_amount").notNull().default("1"),
  dosageUnit: text("dosage_unit").notNull().default("tablet"),
  customUnit: text("custom_unit"),
  memo: text("memo"),
  color: text("color").notNull().default("#3B82F6"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var medicationTimes = pgTable("medication_times", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  medicationId: varchar("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  time: text("time").notNull(),
  label: text("label"),
  mealTiming: text("meal_timing")
});
var doseLogs = pgTable("dose_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationId: varchar("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  scheduledTime: text("scheduled_time").notNull(),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
  photoUri: text("photo_uri"),
  date: text("date").notNull()
});
var connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetId: varchar("target_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  nickname: text("nickname"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var inviteCodes = pgTable("invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at")
});
var nudges = pgTable("nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: varchar("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  medicationName: text("medication_name"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at")
});
var groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var groupMembers = pgTable("group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  timezone: true
});
var insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true
});
var insertMedicationTimeSchema = createInsertSchema(medicationTimes).omit({
  id: true
});
var insertDoseLogSchema = createInsertSchema(doseLogs).omit({
  id: true,
  takenAt: true
});
var insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true
});
var insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true
});

// server/db.ts
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, or, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
function getTimeBlock(time) {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "bedtime";
}
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
var DatabaseStorage = class {
  async createUser(data) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      displayName: data.displayName,
      timezone: data.timezone || "Asia/Seoul"
    }).returning();
    return user;
  }
  async getUserById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async updateUser(id, data) {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }
  async getMedications(userId) {
    const meds = await db.select().from(medications).where(eq(medications.userId, userId)).orderBy(medications.sortOrder);
    const result = [];
    for (const med of meds) {
      const times = await db.select().from(medicationTimes).where(eq(medicationTimes.medicationId, med.id));
      result.push({ ...med, timeEntries: times });
    }
    return result;
  }
  async getMedication(id) {
    const [med] = await db.select().from(medications).where(eq(medications.id, id));
    if (!med) return void 0;
    const times = await db.select().from(medicationTimes).where(eq(medicationTimes.medicationId, med.id));
    return { ...med, timeEntries: times };
  }
  async createMedication(userId, data) {
    const { timeEntries, ...medData } = data;
    const [med] = await db.insert(medications).values({
      userId,
      name: medData.name,
      dosageAmount: medData.dosageAmount,
      dosageUnit: medData.dosageUnit,
      customUnit: medData.customUnit || null,
      memo: medData.memo || null,
      color: medData.color,
      sortOrder: medData.sortOrder || 0
    }).returning();
    const insertedTimes = [];
    for (const entry of timeEntries) {
      const [t] = await db.insert(medicationTimes).values({
        medicationId: med.id,
        time: entry.time,
        label: entry.label || null,
        mealTiming: entry.mealTiming || null
      }).returning();
      insertedTimes.push(t);
    }
    return { ...med, timeEntries: insertedTimes };
  }
  async updateMedication(id, data) {
    const { timeEntries, ...medData } = data;
    const updateData = {};
    if (medData.name !== void 0) updateData.name = medData.name;
    if (medData.dosageAmount !== void 0) updateData.dosageAmount = medData.dosageAmount;
    if (medData.dosageUnit !== void 0) updateData.dosageUnit = medData.dosageUnit;
    if (medData.customUnit !== void 0) updateData.customUnit = medData.customUnit;
    if (medData.memo !== void 0) updateData.memo = medData.memo;
    if (medData.color !== void 0) updateData.color = medData.color;
    if (medData.sortOrder !== void 0) updateData.sortOrder = medData.sortOrder;
    if (Object.keys(updateData).length > 0) {
      await db.update(medications).set(updateData).where(eq(medications.id, id));
    }
    if (timeEntries) {
      await db.delete(medicationTimes).where(eq(medicationTimes.medicationId, id));
      for (const entry of timeEntries) {
        await db.insert(medicationTimes).values({
          medicationId: id,
          time: entry.time,
          label: entry.label || null,
          mealTiming: entry.mealTiming || null
        });
      }
    }
    const [med] = await db.select().from(medications).where(eq(medications.id, id));
    return med;
  }
  async deleteMedication(id) {
    await db.delete(medications).where(eq(medications.id, id));
  }
  async reorderMedications(userId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(medications).set({ sortOrder: i }).where(and(eq(medications.id, orderedIds[i]), eq(medications.userId, userId)));
    }
  }
  async getDoseLogs(userId, date) {
    if (date) {
      return db.select().from(doseLogs).where(and(eq(doseLogs.userId, userId), eq(doseLogs.date, date))).orderBy(desc(doseLogs.takenAt));
    }
    return db.select().from(doseLogs).where(eq(doseLogs.userId, userId)).orderBy(desc(doseLogs.takenAt));
  }
  async createDoseLog(data) {
    const [log2] = await db.insert(doseLogs).values({
      userId: data.userId,
      medicationId: data.medicationId,
      scheduledTime: data.scheduledTime,
      date: data.date,
      photoUri: data.photoUri || null
    }).returning();
    return log2;
  }
  async getDoseLogById(id) {
    const [log2] = await db.select().from(doseLogs).where(eq(doseLogs.id, id));
    return log2;
  }
  async deleteDoseLog(id) {
    await db.delete(doseLogs).where(eq(doseLogs.id, id));
  }
  async getConnections(userId) {
    const conns = await db.select().from(connections).where(or(eq(connections.requesterId, userId), eq(connections.targetId, userId))).orderBy(desc(connections.createdAt));
    const result = [];
    for (const conn of conns) {
      const [requester] = await db.select().from(users).where(eq(users.id, conn.requesterId));
      const [target] = await db.select().from(users).where(eq(users.id, conn.targetId));
      if (requester && target) {
        result.push({ ...conn, requester, target });
      }
    }
    return result;
  }
  async getConnectionById(id) {
    const [conn] = await db.select().from(connections).where(eq(connections.id, id));
    return conn;
  }
  async createConnection(requesterId, targetId, nickname) {
    const [conn] = await db.insert(connections).values({
      requesterId,
      targetId,
      nickname: nickname || null,
      status: "pending"
    }).returning();
    return conn;
  }
  async updateConnectionStatus(id, status) {
    const [conn] = await db.update(connections).set({ status }).where(eq(connections.id, id)).returning();
    return conn;
  }
  async deleteConnection(id) {
    await db.delete(connections).where(eq(connections.id, id));
  }
  async createInviteCode(userId) {
    const code = generateInviteCode();
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const [invite] = await db.insert(inviteCodes).values({
      userId,
      code,
      expiresAt
    }).returning();
    return invite;
  }
  async getInviteByCode(code) {
    const [invite] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code.toUpperCase()));
    return invite;
  }
  async useInviteCode(code, usedBy) {
    const [invite] = await db.update(inviteCodes).set({ usedBy, usedAt: /* @__PURE__ */ new Date() }).where(eq(inviteCodes.code, code.toUpperCase())).returning();
    return invite;
  }
  async createNudge(fromUserId, toUserId, type, medicationName, message) {
    const [nudge] = await db.insert(nudges).values({
      fromUserId,
      toUserId,
      type,
      medicationName: medicationName || null,
      message: message || null
    }).returning();
    return nudge;
  }
  async getNudges(userId) {
    const result = await db.select().from(nudges).where(eq(nudges.toUserId, userId)).orderBy(desc(nudges.createdAt));
    const withUsers = [];
    for (const n of result) {
      const [fromUser] = await db.select().from(users).where(eq(users.id, n.fromUserId));
      if (fromUser) {
        withUsers.push({ ...n, fromUser });
      }
    }
    return withUsers;
  }
  async getNudgeById(id) {
    const [n] = await db.select().from(nudges).where(eq(nudges.id, id));
    return n;
  }
  async markNudgeRead(id) {
    await db.update(nudges).set({ readAt: /* @__PURE__ */ new Date() }).where(eq(nudges.id, id));
  }
  async getUserSummary(userId, date) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");
    const meds = await this.getMedications(userId);
    const logs = await this.getDoseLogs(userId, date);
    let completed = 0;
    let missed = 0;
    let total = 0;
    const blockMap = {};
    const items = [];
    const now = /* @__PURE__ */ new Date();
    for (const med of meds) {
      for (const entry of med.timeEntries) {
        total++;
        const block = getTimeBlock(entry.time);
        if (!blockMap[block]) blockMap[block] = { completed: 0, total: 0 };
        blockMap[block].total++;
        const taken = logs.some((l) => l.medicationId === med.id && l.scheduledTime === entry.time);
        let status;
        if (taken) {
          completed++;
          blockMap[block].completed++;
          status = "taken";
        } else {
          const [h, m] = entry.time.split(":").map(Number);
          const scheduled = /* @__PURE__ */ new Date();
          scheduled.setHours(h, m, 0, 0);
          if (now.getTime() - scheduled.getTime() > 60 * 60 * 1e3) {
            missed++;
            status = "missed";
          } else {
            status = "pending";
          }
        }
        items.push({
          medicationId: med.id,
          name: med.name,
          color: med.color,
          scheduledTime: entry.time,
          block,
          taken,
          status
        });
      }
    }
    items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const blockOrder = ["morning", "afternoon", "evening", "bedtime"];
    const blockSummaries = blockOrder.filter((b) => blockMap[b]).map((b) => ({ block: b, ...blockMap[b] }));
    return {
      user,
      completed,
      pending: total - completed - missed,
      missed,
      total,
      blockSummaries,
      items
    };
  }
  // Push token methods
  async updatePushToken(userId, token) {
    await db.update(users).set({ pushToken: token }).where(eq(users.id, userId));
  }
  async getUserPushToken(userId) {
    const [user] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, userId));
    return user?.pushToken || null;
  }
  // Streak (server-side port of MedicationContext.getStreak)
  async getUserStreak(userId) {
    const meds = await this.getMedications(userId);
    if (meds.length === 0) return 0;
    let streak = 0;
    const today = /* @__PURE__ */ new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLogs = await this.getDoseLogs(userId, dateStr);
      let allTaken = true;
      let anyActive = false;
      for (const med of meds) {
        const createdDate = new Date(med.createdAt).toISOString().split("T")[0];
        if (createdDate > dateStr) continue;
        anyActive = true;
        for (const entry of med.timeEntries) {
          const taken = dayLogs.some((l) => l.medicationId === med.id && l.scheduledTime === entry.time);
          if (!taken) {
            allTaken = false;
            break;
          }
        }
        if (!allTaken) break;
      }
      if (!anyActive) continue;
      if (i === 0 && !allTaken) continue;
      if (allTaken) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }
  // Group methods
  async createGroup(name, createdBy) {
    const [group] = await db.insert(groups).values({ name, createdBy }).returning();
    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: createdBy,
      role: "admin",
      status: "accepted",
      invitedBy: createdBy
    });
    return group;
  }
  async getGroupById(id) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }
  async getGroupsForUser(userId) {
    const myMemberships = await db.select().from(groupMembers).where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "accepted")));
    const result = [];
    for (const m of myMemberships) {
      const [group] = await db.select().from(groups).where(eq(groups.id, m.groupId));
      if (!group) continue;
      const members = await this.getGroupMembers(m.groupId);
      result.push({ ...group, members });
    }
    return result;
  }
  async deleteGroup(id) {
    await db.delete(groups).where(eq(groups.id, id));
  }
  async updateGroupName(id, name) {
    const [group] = await db.update(groups).set({ name }).where(eq(groups.id, id)).returning();
    return group;
  }
  async addGroupMember(groupId, userId, invitedBy, role = "member") {
    const [member] = await db.insert(groupMembers).values({
      groupId,
      userId,
      role,
      invitedBy,
      status: "pending"
    }).returning();
    return member;
  }
  async updateGroupMemberStatus(id, status) {
    const [member] = await db.update(groupMembers).set({ status }).where(eq(groupMembers.id, id)).returning();
    return member;
  }
  async removeGroupMember(id) {
    await db.delete(groupMembers).where(eq(groupMembers.id, id));
  }
  async getGroupMemberById(id) {
    const [member] = await db.select().from(groupMembers).where(eq(groupMembers.id, id));
    return member;
  }
  async getGroupMembers(groupId) {
    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    const result = [];
    for (const m of members) {
      const [user] = await db.select().from(users).where(eq(users.id, m.userId));
      if (user) result.push({ ...m, user });
    }
    return result;
  }
  async getPendingGroupInvites(userId) {
    const pending = await db.select().from(groupMembers).where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "pending")));
    const result = [];
    for (const m of pending) {
      const [group] = await db.select().from(groups).where(eq(groups.id, m.groupId));
      const [inviter] = await db.select().from(users).where(eq(users.id, m.invitedBy));
      if (group && inviter) result.push({ ...m, group, inviter });
    }
    return result;
  }
};
var storage = new DatabaseStorage();

// server/push.ts
import Expo from "expo-server-sdk";
var expo = new Expo();
async function sendPushNotification(pushToken, title, body, data) {
  if (!Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: "default",
        title,
        body,
        data: data || {}
      }
    ]);
  } catch (error) {
    console.error("Push notification failed:", error);
  }
}

// server/routes.ts
async function sendPushToUser(userId, title, body, data) {
  try {
    const token = await storage.getUserPushToken(userId);
    if (token) await sendPushNotification(token, title, body, data);
  } catch {
  }
}
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}
async function registerRoutes(app2) {
  const PgSession = connectPgSimple(session);
  app2.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "pillmate-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1e3,
        httpOnly: true,
        secure: false,
        sameSite: "lax"
      }
    })
  );
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, displayName, timezone } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const user = await storage.createUser({ username, password, displayName, timezone });
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err) {
      console.error("Register error:", err.message);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt2.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err) {
      console.error("Login error:", err.message);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
  });
  app2.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { displayName, timezone, username } = req.body;
      const updateData = {};
      if (displayName !== void 0) updateData.displayName = displayName;
      if (timezone !== void 0) updateData.timezone = timezone;
      if (username !== void 0) {
        const normalized = String(username).trim();
        if (!normalized) return res.status(400).json({ message: "Username required" });
        const existing = await storage.getUserByUsername(normalized);
        if (existing && existing.id !== req.session.userId) {
          return res.status(409).json({ message: "Username already taken" });
        }
        updateData.username = normalized;
      }
      const user = await storage.updateUser(req.session.userId, updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err) {
      res.status(500).json({ message: "Update failed" });
    }
  });
  app2.post("/api/push-token", requireAuth, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token is required" });
      await storage.updatePushToken(req.session.userId, token);
      res.json({ message: "Token registered" });
    } catch {
      res.status(500).json({ message: "Failed to register token" });
    }
  });
  app2.delete("/api/push-token", requireAuth, async (req, res) => {
    try {
      await storage.updatePushToken(req.session.userId, null);
      res.json({ message: "Token removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove token" });
    }
  });
  app2.get("/api/medications", requireAuth, async (req, res) => {
    const meds = await storage.getMedications(req.session.userId);
    res.json(meds);
  });
  app2.post("/api/medications", requireAuth, async (req, res) => {
    try {
      const med = await storage.createMedication(req.session.userId, req.body);
      res.json(med);
    } catch (err) {
      console.error("Create medication error:", err.message);
      res.status(500).json({ message: "Failed to create medication" });
    }
  });
  app2.put("/api/medications/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      await storage.reorderMedications(req.session.userId, orderedIds);
      res.json({ message: "Reordered" });
    } catch (err) {
      res.status(500).json({ message: "Failed to reorder" });
    }
  });
  app2.put("/api/medications/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getMedication(req.params.id);
      if (!existing) return res.status(404).json({ message: "Medication not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const med = await storage.updateMedication(req.params.id, req.body);
      res.json(med);
    } catch (err) {
      res.status(500).json({ message: "Failed to update medication" });
    }
  });
  app2.delete("/api/medications/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getMedication(req.params.id);
      if (!existing) return res.status(404).json({ message: "Medication not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteMedication(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete medication" });
    }
  });
  app2.get("/api/dose-logs", requireAuth, async (req, res) => {
    const date = req.query.date;
    const logs = await storage.getDoseLogs(req.session.userId, date);
    res.json(logs);
  });
  app2.post("/api/dose-logs", requireAuth, async (req, res) => {
    try {
      const { medicationId } = req.body;
      if (medicationId) {
        const med = await storage.getMedication(medicationId);
        if (!med || med.userId !== req.session.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      const log2 = await storage.createDoseLog({
        ...req.body,
        userId: req.session.userId
      });
      res.json(log2);
    } catch (err) {
      console.error("Create dose log error:", err.message);
      res.status(500).json({ message: "Failed to log dose" });
    }
  });
  app2.delete("/api/dose-logs/:id", requireAuth, async (req, res) => {
    try {
      const log2 = await storage.getDoseLogById(req.params.id);
      if (!log2) return res.status(404).json({ message: "Log not found" });
      if (log2.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteDoseLog(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete log" });
    }
  });
  app2.get("/api/connections/pending-count", requireAuth, async (req, res) => {
    try {
      const conns = await storage.getConnections(req.session.userId);
      const count = conns.filter((c) => c.status === "pending" && c.targetId === req.session.userId).length;
      res.json({ count });
    } catch {
      res.json({ count: 0 });
    }
  });
  app2.get("/api/connections", requireAuth, async (req, res) => {
    const conns = await storage.getConnections(req.session.userId);
    const mapped = conns.map((c) => ({
      id: c.id,
      status: c.status,
      nickname: c.nickname,
      createdAt: c.createdAt,
      requester: { id: c.requester.id, displayName: c.requester.displayName, timezone: c.requester.timezone },
      target: { id: c.target.id, displayName: c.target.displayName, timezone: c.target.timezone },
      isRequester: c.requesterId === req.session.userId,
      role: c.requesterId === req.session.userId ? "viewer" : "owner"
    }));
    res.json(mapped);
  });
  app2.post("/api/connections/request", requireAuth, async (req, res) => {
    try {
      const { username, nickname } = req.body;
      if (!username || !username.trim()) {
        return res.status(400).json({ message: "Username is required" });
      }
      const myUserId = req.session.userId;
      const target = await storage.getUserByUsername(username.trim());
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      if (target.id === myUserId) {
        return res.status(400).json({ message: "Cannot add yourself" });
      }
      const conns = await storage.getConnections(myUserId);
      const existing = conns.find(
        (c) => c.requesterId === myUserId && c.targetId === target.id || c.targetId === myUserId && c.requesterId === target.id
      );
      if (existing) {
        if (existing.status === "accepted") {
          return res.status(409).json({ message: "Already connected" });
        }
        if (existing.status === "pending") {
          return res.status(409).json({ message: "Request already pending" });
        }
        await storage.deleteConnection(existing.id);
      }
      const conn = await storage.createConnection(myUserId, target.id, nickname);
      const me = await storage.getUserById(myUserId);
      sendPushToUser(target.id, "Friend Request", `${me?.displayName || "Someone"} wants to connect with you`, { type: "friend_request" });
      res.json(conn);
    } catch (err) {
      console.error("Connection request error:", err.message);
      res.status(500).json({ message: "Failed to send request" });
    }
  });
  app2.post("/api/connections/respond", requireAuth, async (req, res) => {
    try {
      const { connectionId, accept } = req.body;
      const conn = await storage.getConnectionById(connectionId);
      if (!conn) return res.status(404).json({ message: "Connection not found" });
      if (conn.targetId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const status = accept ? "accepted" : "rejected";
      const updated = await storage.updateConnectionStatus(connectionId, status);
      if (accept) {
        const me = await storage.getUserById(req.session.userId);
        sendPushToUser(conn.requesterId, "Friend Request Accepted", `${me?.displayName || "Someone"} accepted your friend request`, { type: "friend_accepted" });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to respond" });
    }
  });
  app2.delete("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      const conn = await storage.getConnectionById(req.params.id);
      if (!conn) return res.status(404).json({ message: "Connection not found" });
      if (conn.requesterId !== req.session.userId && conn.targetId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteConnection(req.params.id);
      res.json({ message: "Disconnected" });
    } catch (err) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });
  app2.post("/api/invites", requireAuth, async (req, res) => {
    try {
      const invite = await storage.createInviteCode(req.session.userId);
      res.json(invite);
    } catch (err) {
      res.status(500).json({ message: "Failed to create invite" });
    }
  });
  app2.post("/api/invites/accept", requireAuth, async (req, res) => {
    try {
      const { code, nickname } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });
      const invite = await storage.getInviteByCode(code);
      if (!invite) return res.status(404).json({ message: "Invalid invite code" });
      if (invite.usedBy) return res.status(400).json({ message: "Code already used" });
      if (/* @__PURE__ */ new Date() > invite.expiresAt) return res.status(400).json({ message: "Code expired" });
      if (invite.userId === req.session.userId) return res.status(400).json({ message: "Cannot accept your own invite" });
      await storage.useInviteCode(code, req.session.userId);
      const conn = await storage.createConnection(req.session.userId, invite.userId, nickname);
      const accepted = await storage.updateConnectionStatus(conn.id, "accepted");
      res.json(accepted);
    } catch (err) {
      console.error("Accept invite error:", err.message);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });
  app2.get("/api/summary/:userId", requireAuth, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const myUserId = req.session.userId;
      if (targetUserId !== myUserId) {
        const conns = await storage.getConnections(myUserId);
        const hasAccess = conns.some(
          (c) => c.status === "accepted" && (c.requesterId === myUserId && c.targetId === targetUserId || c.targetId === myUserId && c.requesterId === targetUserId)
        );
        if (!hasAccess) {
          return res.status(403).json({ message: "Not authorized to view this user's data" });
        }
      }
      const date = req.query.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const [summary, streak] = await Promise.all([
        storage.getUserSummary(targetUserId, date),
        storage.getUserStreak(targetUserId)
      ]);
      res.json({
        user: {
          id: summary.user.id,
          displayName: summary.user.displayName,
          timezone: summary.user.timezone
        },
        streak,
        completed: summary.completed,
        pending: summary.pending,
        missed: summary.missed,
        total: summary.total,
        blockSummaries: summary.blockSummaries,
        items: summary.items
      });
    } catch (err) {
      console.error("Summary error:", err.message);
      res.status(500).json({ message: "Failed to get summary" });
    }
  });
  app2.post("/api/nudges", requireAuth, async (req, res) => {
    try {
      const { toUserId, type, medicationName, message } = req.body;
      const allowedTypes = ["reminder", "praise", "heart", "time"];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid nudge type" });
      }
      const conns = await storage.getConnections(req.session.userId);
      const hasAccess = conns.some(
        (c) => c.status === "accepted" && (c.requesterId === req.session.userId && c.targetId === toUserId || c.targetId === req.session.userId && c.requesterId === toUserId)
      );
      if (!hasAccess) return res.status(403).json({ message: "Not connected" });
      const cleanMessage = typeof message === "string" ? message.slice(0, 200) : null;
      const cleanMedName = typeof medicationName === "string" ? medicationName.slice(0, 100) : null;
      const nudge = await storage.createNudge(req.session.userId, toUserId, type, cleanMedName, cleanMessage);
      const me = await storage.getUserById(req.session.userId);
      const pushBody = cleanMessage || (type === "praise" ? "Great job! \u{1F44F}" : "Time for your meds \u{1F48A}");
      sendPushToUser(toUserId, `${me?.displayName || "Friend"}`, pushBody, { type: "nudge" });
      res.json(nudge);
    } catch (err) {
      res.status(500).json({ message: "Failed to send nudge" });
    }
  });
  app2.get("/api/nudges", requireAuth, async (req, res) => {
    const nudgeList = await storage.getNudges(req.session.userId);
    res.json(nudgeList.map((n) => ({
      id: n.id,
      type: n.type,
      medicationName: n.medicationName,
      message: n.message,
      fromUser: { id: n.fromUser.id, displayName: n.fromUser.displayName },
      createdAt: n.createdAt,
      readAt: n.readAt
    })));
  });
  app2.put("/api/nudges/:id/read", requireAuth, async (req, res) => {
    const nudge = await storage.getNudgeById(req.params.id);
    if (!nudge) return res.status(404).json({ message: "Nudge not found" });
    if (nudge.toUserId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
    await storage.markNudgeRead(req.params.id);
    res.json({ message: "Marked as read" });
  });
  app2.get("/api/groups/pending-count", requireAuth, async (req, res) => {
    try {
      const invites = await storage.getPendingGroupInvites(req.session.userId);
      res.json({ count: invites.length });
    } catch {
      res.json({ count: 0 });
    }
  });
  app2.get("/api/groups/pending-invites", requireAuth, async (req, res) => {
    try {
      const invites = await storage.getPendingGroupInvites(req.session.userId);
      res.json(invites.map((inv) => ({
        memberId: inv.id,
        groupId: inv.group.id,
        groupName: inv.group.name,
        inviterName: inv.inviter.displayName
      })));
    } catch {
      res.json([]);
    }
  });
  app2.post("/api/groups", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Group name is required" });
      const group = await storage.createGroup(name.trim().slice(0, 50), req.session.userId);
      res.json(group);
    } catch (err) {
      res.status(500).json({ message: "Failed to create group" });
    }
  });
  app2.get("/api/groups", requireAuth, async (req, res) => {
    try {
      const groupsData = await storage.getGroupsForUser(req.session.userId);
      res.json(groupsData.map((g) => ({
        id: g.id,
        name: g.name,
        createdBy: g.createdBy,
        createdAt: g.createdAt,
        isAdmin: g.createdBy === req.session.userId,
        members: g.members.filter((m) => m.status === "accepted" || m.status === "pending").map((m) => ({
          id: m.id,
          userId: m.userId,
          displayName: m.user.displayName,
          role: m.role,
          status: m.status
        }))
      })));
    } catch {
      res.status(500).json({ message: "Failed to load groups" });
    }
  });
  app2.put("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can rename" });
      const updated = await storage.updateGroupName(req.params.id, req.body.name?.trim().slice(0, 50));
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update group" });
    }
  });
  app2.delete("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can delete" });
      await storage.deleteGroup(req.params.id);
      res.json({ message: "Group deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });
  app2.post("/api/groups/:id/invite", requireAuth, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can invite" });
      const { username } = req.body;
      if (!username?.trim()) return res.status(400).json({ message: "Username is required" });
      const target = await storage.getUserByUsername(username.trim());
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.id === req.session.userId) return res.status(400).json({ message: "Cannot invite yourself" });
      const members = await storage.getGroupMembers(req.params.id);
      const existing = members.find((m) => m.userId === target.id);
      if (existing && (existing.status === "accepted" || existing.status === "pending")) {
        return res.status(409).json({ message: "User already in group or invited" });
      }
      if (existing) await storage.removeGroupMember(existing.id);
      const member = await storage.addGroupMember(req.params.id, target.id, req.session.userId);
      const me = await storage.getUserById(req.session.userId);
      sendPushToUser(target.id, "Group Invitation", `${me?.displayName || "Someone"} invited you to "${group.name}"`, { type: "group_invite", groupId: group.id });
      res.json(member);
    } catch (err) {
      res.status(500).json({ message: "Failed to invite member" });
    }
  });
  app2.post("/api/groups/invites/respond", requireAuth, async (req, res) => {
    try {
      const { memberId, accept } = req.body;
      const member = await storage.getGroupMemberById(memberId);
      if (!member) return res.status(404).json({ message: "Invitation not found" });
      if (member.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateGroupMemberStatus(memberId, accept ? "accepted" : "rejected");
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to respond to invitation" });
    }
  });
  app2.delete("/api/groups/:groupId/members/:memberId", requireAuth, async (req, res) => {
    try {
      const group = await storage.getGroupById(req.params.groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can remove members" });
      const member = await storage.getGroupMemberById(req.params.memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
      if (member.userId === req.session.userId) return res.status(400).json({ message: "Cannot remove yourself" });
      await storage.removeGroupMember(req.params.memberId);
      res.json({ message: "Member removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });
  app2.get("/api/groups/:id/dashboard", requireAuth, async (req, res) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      const isMember = members.some((m) => m.userId === req.session.userId && m.status === "accepted");
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });
      const group = await storage.getGroupById(req.params.id);
      const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const accepted = members.filter((m) => m.status === "accepted");
      const memberData = await Promise.all(accepted.map(async (m) => {
        const [summary, streak] = await Promise.all([
          storage.getUserSummary(m.userId, date),
          storage.getUserStreak(m.userId)
        ]);
        return {
          userId: m.userId,
          displayName: m.user.displayName,
          role: m.role,
          summary: {
            completed: summary.completed,
            pending: summary.pending,
            missed: summary.missed,
            total: summary.total,
            streak
          }
        };
      }));
      res.json({ group, members: memberData });
    } catch {
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });
  app2.post("/api/groups/:id/nudge", requireAuth, async (req, res) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      const isMember = members.some((m) => m.userId === req.session.userId && m.status === "accepted");
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });
      const group = await storage.getGroupById(req.params.id);
      const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const me = await storage.getUserById(req.session.userId);
      const { message } = req.body;
      let sent = 0;
      for (const m of members.filter((m2) => m2.status === "accepted" && m2.userId !== req.session.userId)) {
        const summary = await storage.getUserSummary(m.userId, date);
        if (summary.completed < summary.total) {
          const nudgeMsg = message || "Time for your meds! \u{1F48A}";
          await storage.createNudge(req.session.userId, m.userId, "reminder", null, nudgeMsg);
          sendPushToUser(m.userId, `${group?.name || "Group"}`, `${me?.displayName || "Someone"}: ${nudgeMsg}`, { type: "group_nudge" });
          sent++;
        }
      }
      res.json({ sent });
    } catch {
      res.status(500).json({ message: "Failed to send group nudge" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
