#!/bin/bash
set -e

# Post-merge reconciliation for PillMate.
# Installs any newly merged dependencies. Runs non-interactively (stdin closed).
#
# NOTE: We deliberately do NOT run `npm run db:push` here. drizzle-kit push
# wants to DROP the connect-pg-simple `session` table (it is not part of the
# Drizzle schema), and stdin is closed during post-merge so it cannot be
# confirmed safely. Schema changes are applied deliberately with additive SQL
# (ALTER TABLE ... ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).

echo "post-merge: installing dependencies"
npm install --no-audit --no-fund

echo "post-merge: done"
