import { eq, and, or, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, medications, medicationTimes, doseLogs,
  connections, inviteCodes, nudges,
  type User, type InsertUser, type Medication, type MedicationTime,
  type DoseLog, type Connection, type InviteCode, type Nudge,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  createUser(data: { username: string; password: string; displayName: string; timezone?: string }): Promise<User>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<Pick<User, 'displayName' | 'timezone'>>): Promise<User | undefined>;

  getMedications(userId: string): Promise<(Medication & { timeEntries: MedicationTime[] })[]>;
  getMedication(id: string): Promise<(Medication & { timeEntries: MedicationTime[] }) | undefined>;
  createMedication(userId: string, data: {
    name: string; dosageAmount: string; dosageUnit: string;
    customUnit?: string; memo?: string; color: string; sortOrder?: number;
    timeEntries: { time: string; label?: string; mealTiming?: string | null }[];
  }): Promise<Medication & { timeEntries: MedicationTime[] }>;
  updateMedication(id: string, data: Partial<{
    name: string; dosageAmount: string; dosageUnit: string;
    customUnit?: string; memo?: string; color: string; sortOrder?: number;
    timeEntries?: { time: string; label?: string; mealTiming?: string | null }[];
  }>): Promise<Medication | undefined>;
  deleteMedication(id: string): Promise<void>;
  reorderMedications(userId: string, orderedIds: string[]): Promise<void>;

  getDoseLogs(userId: string, date?: string): Promise<DoseLog[]>;
  getDoseLogById(id: string): Promise<DoseLog | undefined>;
  createDoseLog(data: { userId: string; medicationId: string; scheduledTime: string; date: string; photoUri?: string }): Promise<DoseLog>;
  deleteDoseLog(id: string): Promise<void>;

  getConnections(userId: string): Promise<(Connection & { requester: User; target: User })[]>;
  getConnectionById(id: string): Promise<Connection | undefined>;
  createConnection(requesterId: string, targetId: string, nickname?: string): Promise<Connection>;
  updateConnectionStatus(id: string, status: string): Promise<Connection | undefined>;
  deleteConnection(id: string): Promise<void>;

  createInviteCode(userId: string): Promise<InviteCode>;
  getInviteByCode(code: string): Promise<InviteCode | undefined>;
  useInviteCode(code: string, usedBy: string): Promise<InviteCode | undefined>;

  createNudge(fromUserId: string, toUserId: string, type: string, medicationName?: string | null, message?: string | null): Promise<Nudge>;
  getNudges(userId: string): Promise<(Nudge & { fromUser: User })[]>;
  getNudgeById(id: string): Promise<Nudge | undefined>;
  markNudgeRead(id: string): Promise<void>;

  getUserSummary(userId: string, date: string): Promise<{
    user: User;
    completed: number;
    pending: number;
    missed: number;
    total: number;
    blockSummaries: { block: string; completed: number; total: number }[];
    items: SummaryItem[];
  }>;
}

export interface SummaryItem {
  medicationId: string;
  name: string;
  color: string;
  scheduledTime: string;
  block: string;
  taken: boolean;
  status: "taken" | "pending" | "missed";
}

function getTimeBlock(time: string): string {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "bedtime";
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class DatabaseStorage implements IStorage {
  async createUser(data: { username: string; password: string; displayName: string; timezone?: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      displayName: data.displayName,
      timezone: data.timezone || "Asia/Seoul",
    }).returning();
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async updateUser(id: string, data: Partial<Pick<User, 'displayName' | 'timezone'>>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getMedications(userId: string): Promise<(Medication & { timeEntries: MedicationTime[] })[]> {
    const meds = await db.select().from(medications)
      .where(eq(medications.userId, userId))
      .orderBy(medications.sortOrder);

    const result = [];
    for (const med of meds) {
      const times = await db.select().from(medicationTimes)
        .where(eq(medicationTimes.medicationId, med.id));
      result.push({ ...med, timeEntries: times });
    }
    return result;
  }

  async getMedication(id: string): Promise<(Medication & { timeEntries: MedicationTime[] }) | undefined> {
    const [med] = await db.select().from(medications).where(eq(medications.id, id));
    if (!med) return undefined;
    const times = await db.select().from(medicationTimes)
      .where(eq(medicationTimes.medicationId, med.id));
    return { ...med, timeEntries: times };
  }

  async createMedication(userId: string, data: {
    name: string; dosageAmount: string; dosageUnit: string;
    customUnit?: string; memo?: string; color: string; sortOrder?: number;
    timeEntries: { time: string; label?: string; mealTiming?: string | null }[];
  }): Promise<Medication & { timeEntries: MedicationTime[] }> {
    const { timeEntries, ...medData } = data;
    const [med] = await db.insert(medications).values({
      userId,
      name: medData.name,
      dosageAmount: medData.dosageAmount,
      dosageUnit: medData.dosageUnit,
      customUnit: medData.customUnit || null,
      memo: medData.memo || null,
      color: medData.color,
      sortOrder: medData.sortOrder || 0,
    }).returning();

    const insertedTimes: MedicationTime[] = [];
    for (const entry of timeEntries) {
      const [t] = await db.insert(medicationTimes).values({
        medicationId: med.id,
        time: entry.time,
        label: entry.label || null,
        mealTiming: entry.mealTiming || null,
      }).returning();
      insertedTimes.push(t);
    }

    return { ...med, timeEntries: insertedTimes };
  }

  async updateMedication(id: string, data: Partial<{
    name: string; dosageAmount: string; dosageUnit: string;
    customUnit?: string; memo?: string; color: string; sortOrder?: number;
    timeEntries?: { time: string; label?: string; mealTiming?: string | null }[];
  }>): Promise<Medication | undefined> {
    const { timeEntries, ...medData } = data;
    const updateData: Record<string, any> = {};
    if (medData.name !== undefined) updateData.name = medData.name;
    if (medData.dosageAmount !== undefined) updateData.dosageAmount = medData.dosageAmount;
    if (medData.dosageUnit !== undefined) updateData.dosageUnit = medData.dosageUnit;
    if (medData.customUnit !== undefined) updateData.customUnit = medData.customUnit;
    if (medData.memo !== undefined) updateData.memo = medData.memo;
    if (medData.color !== undefined) updateData.color = medData.color;
    if (medData.sortOrder !== undefined) updateData.sortOrder = medData.sortOrder;

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
          mealTiming: entry.mealTiming || null,
        });
      }
    }

    const [med] = await db.select().from(medications).where(eq(medications.id, id));
    return med;
  }

  async deleteMedication(id: string): Promise<void> {
    await db.delete(medications).where(eq(medications.id, id));
  }

  async reorderMedications(userId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(medications)
        .set({ sortOrder: i })
        .where(and(eq(medications.id, orderedIds[i]), eq(medications.userId, userId)));
    }
  }

  async getDoseLogs(userId: string, date?: string): Promise<DoseLog[]> {
    if (date) {
      return db.select().from(doseLogs)
        .where(and(eq(doseLogs.userId, userId), eq(doseLogs.date, date)))
        .orderBy(desc(doseLogs.takenAt));
    }
    return db.select().from(doseLogs)
      .where(eq(doseLogs.userId, userId))
      .orderBy(desc(doseLogs.takenAt));
  }

  async createDoseLog(data: { userId: string; medicationId: string; scheduledTime: string; date: string; photoUri?: string }): Promise<DoseLog> {
    const [log] = await db.insert(doseLogs).values({
      userId: data.userId,
      medicationId: data.medicationId,
      scheduledTime: data.scheduledTime,
      date: data.date,
      photoUri: data.photoUri || null,
    }).returning();
    return log;
  }

  async getDoseLogById(id: string): Promise<DoseLog | undefined> {
    const [log] = await db.select().from(doseLogs).where(eq(doseLogs.id, id));
    return log;
  }

  async deleteDoseLog(id: string): Promise<void> {
    await db.delete(doseLogs).where(eq(doseLogs.id, id));
  }

  async getConnections(userId: string): Promise<(Connection & { requester: User; target: User })[]> {
    const conns = await db.select().from(connections)
      .where(or(eq(connections.requesterId, userId), eq(connections.targetId, userId)))
      .orderBy(desc(connections.createdAt));

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

  async getConnectionById(id: string): Promise<Connection | undefined> {
    const [conn] = await db.select().from(connections).where(eq(connections.id, id));
    return conn;
  }

  async createConnection(requesterId: string, targetId: string, nickname?: string): Promise<Connection> {
    const [conn] = await db.insert(connections).values({
      requesterId,
      targetId,
      nickname: nickname || null,
      status: "pending",
    }).returning();
    return conn;
  }

  async updateConnectionStatus(id: string, status: string): Promise<Connection | undefined> {
    const [conn] = await db.update(connections)
      .set({ status })
      .where(eq(connections.id, id))
      .returning();
    return conn;
  }

  async deleteConnection(id: string): Promise<void> {
    await db.delete(connections).where(eq(connections.id, id));
  }

  async createInviteCode(userId: string): Promise<InviteCode> {
    const code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await db.insert(inviteCodes).values({
      userId,
      code,
      expiresAt,
    }).returning();
    return invite;
  }

  async getInviteByCode(code: string): Promise<InviteCode | undefined> {
    const [invite] = await db.select().from(inviteCodes)
      .where(eq(inviteCodes.code, code.toUpperCase()));
    return invite;
  }

  async useInviteCode(code: string, usedBy: string): Promise<InviteCode | undefined> {
    const [invite] = await db.update(inviteCodes)
      .set({ usedBy, usedAt: new Date() })
      .where(eq(inviteCodes.code, code.toUpperCase()))
      .returning();
    return invite;
  }

  async createNudge(fromUserId: string, toUserId: string, type: string, medicationName?: string | null, message?: string | null): Promise<Nudge> {
    const [nudge] = await db.insert(nudges).values({
      fromUserId,
      toUserId,
      type,
      medicationName: medicationName || null,
      message: message || null,
    }).returning();
    return nudge;
  }

  async getNudges(userId: string): Promise<(Nudge & { fromUser: User })[]> {
    const result = await db.select().from(nudges)
      .where(eq(nudges.toUserId, userId))
      .orderBy(desc(nudges.createdAt));

    const withUsers = [];
    for (const n of result) {
      const [fromUser] = await db.select().from(users).where(eq(users.id, n.fromUserId));
      if (fromUser) {
        withUsers.push({ ...n, fromUser });
      }
    }
    return withUsers;
  }

  async getNudgeById(id: string): Promise<Nudge | undefined> {
    const [n] = await db.select().from(nudges).where(eq(nudges.id, id));
    return n;
  }

  async markNudgeRead(id: string): Promise<void> {
    await db.update(nudges).set({ readAt: new Date() }).where(eq(nudges.id, id));
  }

  async getUserSummary(userId: string, date: string): Promise<{
    user: User;
    completed: number;
    pending: number;
    missed: number;
    total: number;
    blockSummaries: { block: string; completed: number; total: number }[];
    items: SummaryItem[];
  }> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");

    const meds = await this.getMedications(userId);
    const logs = await this.getDoseLogs(userId, date);

    let completed = 0;
    let missed = 0;
    let total = 0;
    const blockMap: Record<string, { completed: number; total: number }> = {};
    const items: SummaryItem[] = [];

    const now = new Date();

    for (const med of meds) {
      for (const entry of med.timeEntries) {
        total++;
        const block = getTimeBlock(entry.time);
        if (!blockMap[block]) blockMap[block] = { completed: 0, total: 0 };
        blockMap[block].total++;

        const taken = logs.some(l => l.medicationId === med.id && l.scheduledTime === entry.time);
        let status: SummaryItem["status"];
        if (taken) {
          completed++;
          blockMap[block].completed++;
          status = "taken";
        } else {
          const [h, m] = entry.time.split(":").map(Number);
          const scheduled = new Date();
          scheduled.setHours(h, m, 0, 0);
          if (now.getTime() - scheduled.getTime() > 60 * 60 * 1000) {
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
          status,
        });
      }
    }

    items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    const blockOrder = ["morning", "afternoon", "evening", "bedtime"];
    const blockSummaries = blockOrder
      .filter(b => blockMap[b])
      .map(b => ({ block: b, ...blockMap[b] }));

    return {
      user,
      completed,
      pending: total - completed - missed,
      missed,
      total,
      blockSummaries,
      items,
    };
  }
}

export const storage = new DatabaseStorage();
