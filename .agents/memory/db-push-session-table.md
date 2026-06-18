---
name: db:push session table trap
description: Why drizzle db:push is dangerous here and how to apply nudges/additive schema changes safely
---

`npm run db:push` (drizzle-kit) compares the live DB to `shared/schema.ts`. The `session` table is created at runtime by `connect-pg-simple` and is NOT in the Drizzle schema, so push reports it as "data-loss" and offers to DROP it (interactive prompt). Dropping it logs out all users.

**Rule:** Never confirm the db:push drop prompt. For additive column changes (e.g. `nudges.medication_name`, `nudges.message`), apply them directly with idempotent SQL: `ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>;` (via the database executeSql callback). Then mirror the column in `shared/schema.ts` so the ORM types stay correct.

**Why:** preserves live session data; avoids the interactive abort. **How to apply:** any time you add columns to an existing table on this project, prefer direct ALTER over db:push until the session table is added to the schema or excluded.
