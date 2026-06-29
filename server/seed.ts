import { db, pool } from "./db";
import { users, medications, medicationTimes, doseLogs, connections } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const existingUser = await db.select().from(users).where(eq(users.username, "demo"));
  if (existingUser.length > 0) {
    console.log("Demo data already exists, skipping seed.");
    await pool.end();
    return;
  }

  const pw = await bcrypt.hash("1234", 10);

  const [mainUser] = await db.insert(users).values({
    username: "demo",
    password: pw,
    displayName: "나",
    timezone: "Asia/Seoul",
  }).returning();

  const [mom] = await db.insert(users).values({
    username: "mom",
    password: pw,
    displayName: "엄마",
    timezone: "Asia/Seoul",
  }).returning();

  const [dad] = await db.insert(users).values({
    username: "dad",
    password: pw,
    displayName: "아빠",
    timezone: "Asia/Seoul",
  }).returning();

  const today = new Date().toISOString().split("T")[0];

  const [med1] = await db.insert(medications).values({
    userId: mom.id, name: "혈압약", dosageAmount: "1", dosageUnit: "tablet",
    color: "#EF4444", sortOrder: 0,
  }).returning();
  await db.insert(medicationTimes).values([
    { medicationId: med1.id, time: "08:00", label: "meal:breakfast:after", mealTiming: "after" },
    { medicationId: med1.id, time: "20:00", label: "meal:dinner:after", mealTiming: "after" },
  ]);

  const [med2] = await db.insert(medications).values({
    userId: mom.id, name: "비타민 D", dosageAmount: "1", dosageUnit: "tablet",
    color: "#F59E0B", sortOrder: 1,
  }).returning();
  await db.insert(medicationTimes).values([
    { medicationId: med2.id, time: "09:00", label: "meal:breakfast:during", mealTiming: "during" },
  ]);

  const [med3] = await db.insert(medications).values({
    userId: mom.id, name: "칼슘", dosageAmount: "2", dosageUnit: "tablet",
    color: "#10B981", sortOrder: 2,
  }).returning();
  await db.insert(medicationTimes).values([
    { medicationId: med3.id, time: "12:00", label: "meal:lunch:after", mealTiming: "after" },
  ]);

  await db.insert(doseLogs).values([
    { userId: mom.id, medicationId: med1.id, scheduledTime: "08:00", date: today },
    { userId: mom.id, medicationId: med2.id, scheduledTime: "09:00", date: today },
  ]);

  const [med4] = await db.insert(medications).values({
    userId: dad.id, name: "당뇨약", dosageAmount: "1", dosageUnit: "tablet",
    color: "#3B82F6", sortOrder: 0,
  }).returning();
  await db.insert(medicationTimes).values([
    { medicationId: med4.id, time: "07:00", label: "meal:breakfast:before", mealTiming: "before" },
    { medicationId: med4.id, time: "18:00", label: "meal:dinner:before", mealTiming: "before" },
  ]);

  const [med5] = await db.insert(medications).values({
    userId: dad.id, name: "오메가-3", dosageAmount: "1", dosageUnit: "tablet",
    color: "#8B5CF6", sortOrder: 1,
  }).returning();
  await db.insert(medicationTimes).values([
    { medicationId: med5.id, time: "09:00", label: "meal:breakfast:after", mealTiming: "after" },
  ]);

  await db.insert(doseLogs).values([
    { userId: dad.id, medicationId: med4.id, scheduledTime: "07:00", date: today },
  ]);

  await db.insert(connections).values([
    { requesterId: mainUser.id, targetId: mom.id, status: "accepted", nickname: "엄마" },
    { requesterId: mainUser.id, targetId: dad.id, status: "accepted", nickname: "아빠" },
  ]);

  console.log("Seed complete!");
  console.log(`Demo accounts: demo/1234, mom/1234, dad/1234`);
  await pool.end();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
