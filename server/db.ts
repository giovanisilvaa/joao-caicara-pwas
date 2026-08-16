import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, systemMonitor, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSystemMonitor(service: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(systemMonitor).where(eq(systemMonitor.service, service)).limit(1);
  return rows[0];
}

export async function upsertSystemMonitor(service: string, status: "unknown" | "up" | "down", lastCheckedAt: Date, lastAlertAt?: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getSystemMonitor(service);
  const values = { service, status, lastCheckedAt, lastAlertAt: lastAlertAt ?? null };
  if (existing) {
    await db.update(systemMonitor).set(values).where(eq(systemMonitor.service, service));
  } else {
    await db.insert(systemMonitor).values(values);
  }
  return getSystemMonitor(service);
}

export async function setSystemMonitorTaskUid(service: string, taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(systemMonitor).set({ scheduleCronTaskUid: taskUid }).where(eq(systemMonitor.service, service));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function updateUserRole(openId: string, role: NonNullable<InsertUser['role']>) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.update(users).set({ role }).where(eq(users.openId, openId));
  return getUserByOpenId(openId);
}
