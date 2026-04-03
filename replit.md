# PillMate - Medication Tracking App

## Overview

PillMate is a "medication clarity and confidence" mobile application built with Expo (React Native) and an Express backend. It helps users instantly know whether they took their medication, whether they still need to take it, and prevents accidental duplicate doses. The app features a Today Dashboard grouped by time blocks (Morning, Afternoon, Evening, Bedtime) with one-tap check-in, undo capability, duplicate-dose protection, and a consent-based caregiver/family sharing system with invite codes, multi-person viewing, and nudges. It supports both Korean and English languages (Korean default).

The project uses a monorepo-style structure with the mobile app (Expo/React Native) in the root and an Express API server in the `server/` directory. All data (medications, dose logs, connections, nudges) is stored server-side in PostgreSQL with session-based authentication. The server includes MFDS (Korean FDA) drug info API proxy routes (available at `/api/drug/search` and `/api/drug/dur`).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Mobile App)
- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`)
- **Routing**: expo-router with file-based routing. Four main tabs (Today Dashboard, Medications, History, Caregiver/Family) plus modal screens for adding medications and taking photos
- **State Management**: React Context (`MedicationContext`, `LanguageContext`, `AuthContext`) with server API backing. MedicationContext fetches/mutates data via Express API. AuthContext manages session-based login/logout.
- **UI**: Custom components with no external UI library. Uses Inter font family, custom color constants in `constants/colors.ts`, react-native-reanimated for animations, and expo-haptics for tactile feedback
- **Internationalization**: Custom i18n implementation via `LanguageContext` supporting Korean (`ko`) and English (`en`)
- **Key screens**:
  - `app/auth.tsx` — Login/register screen (auth-gated, shown when not logged in)
  - `app/(tabs)/index.tsx` — Today Dashboard with time-block grouping (Morning/Afternoon/Evening/Bedtime), one-tap check-in with undo snackbar, duplicate-dose protection, visual status indicators (green=taken, gray=pending, yellow=overdue, red=duplicate), "last taken" timestamps, guilt-free messaging, and 100% completion success card
  - `app/(tabs)/medications.tsx` — List of all medications with delete, edit, drag-to-reorder, plus a profile/settings footer showing user info, language toggle, and logout
  - `app/(tabs)/history.tsx` — Statistics (streak, weekly chart, completion rates), links to monthly calendar and photo archive
  - `app/(tabs)/caregiver.tsx` — Real caregiver sharing: invite code generation (6-char, 7-day expiry), code acceptance, multi-person viewer cards with timezone labels, block-level summaries, nudge system (heart/pill/clock/thumbsup emojis)
  - `app/add-medication.tsx` — Form sheet modal for adding new medications (name, dosage, timing, color)
  - `app/take-photo.tsx` — Camera modal for photo verification when logging a dose
  - `app/drug-info.tsx` — MFDS drug info search (accessible via direct navigation, not main tabs)

### Backend (Express Server)
- **Framework**: Express 5 running on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **Entry point**: `server/index.ts` — sets up CORS (supports Replit domains and localhost), serves static files in production
- **Auth**: Session-based authentication using `express-session` + `connect-pg-simple` (session table auto-created in PostgreSQL). Passwords hashed with bcryptjs.
- **Routes**: `server/routes.ts` — full REST API:
  - Auth: POST `/api/auth/register`, POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`, PUT `/api/auth/profile`
  - Medications: GET/POST `/api/medications`, PUT/DELETE `/api/medications/:id`, PUT `/api/medications/reorder`
  - Dose logs: GET/POST `/api/dose-logs`, DELETE `/api/dose-logs/:id`
  - Connections: GET `/api/connections`, POST `/api/connections/respond`, DELETE `/api/connections/:id`
  - Invites: POST `/api/invites`, POST `/api/invites/accept`
  - Nudges: GET `/api/nudges`, POST `/api/nudges`, PUT `/api/nudges/:id/read`
  - Summaries: GET `/api/summary/:userId`
  - Drug info: GET `/api/drug/search`, GET `/api/drug/dur`
- **Authorization**: All mutation endpoints verify resource ownership (user can only modify their own medications, dose logs, connections, nudges). Ownership checks use `getMedication`, `getDoseLogById`, `getConnectionById`, `getNudgeById` before allowing mutations.
- **Storage**: `server/storage.ts` — `DatabaseStorage` class with full PostgreSQL CRUD via Drizzle ORM
- **Seed data**: Demo accounts seeded on startup — `demo/1234`, `mom/1234`, `dad/1234` with pre-configured medications and connections

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — tables: `users`, `medications`, `medication_times`, `dose_logs`, `connections`, `invite_codes`, `nudges`
- **Config**: `drizzle.config.ts` — requires `DATABASE_URL` environment variable, outputs migrations to `./migrations`
- **Push command**: `npm run db:push` runs `drizzle-kit push` to sync schema to database

### Data Flow
- All medication, dose log, connection, and nudge data is managed server-side via PostgreSQL
- `MedicationContext` acts as a bridge: fetches from `/api/medications` and `/api/dose-logs`, exposes same interface as before
- `AuthContext` manages login/register/logout via session API
- Caregiver tab fetches connected users' summaries via `/api/summary/:userId`
- `lib/query-client.ts` provides `apiRequest()` and `getApiUrl()` for making authenticated API calls

### Build & Deployment
- **Development**: Two processes — `expo:dev` for the mobile app (port 8081) and `server:dev` for the Express server (port 5000)
- **Production**: `expo:static:build` creates a static web build, `server:build` bundles the server with esbuild, `server:prod` serves both the API and static assets
- **Static build script**: `scripts/build.js` handles the Expo web build process with Metro bundler

## External Dependencies

### Core Technologies
- **Expo SDK 54** — React Native development framework
- **Express 5** — Backend API server
- **PostgreSQL** — Database (via `DATABASE_URL` environment variable)
- **Drizzle ORM** — Database ORM and migration management

### Key Libraries
- **TanStack React Query** — Server state management and data fetching
- **express-session** + **connect-pg-simple** — Session-based authentication with PostgreSQL session store
- **bcryptjs** — Password hashing
- **expo-clipboard** — Clipboard access for invite code copying
- **expo-camera** — Camera access for dose photo verification
- **expo-image-picker** — Image selection from device gallery
- **expo-haptics** — Haptic feedback on interactions
- **react-native-reanimated** — Smooth animations
- **react-native-keyboard-controller** — Keyboard-aware scrolling
- **react-native-gesture-handler** — Touch gesture handling
- **Zod** — Schema validation (used with drizzle-zod)
- **patch-package** — Applied via `postinstall` for dependency patches

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required for server/database)
- `SESSION_SECRET` — Session encryption secret (required for production)
- `MFDS_API_KEY` — Korean FDA drug info API key
- `REPLIT_DEV_DOMAIN` — Used for Expo dev server proxy and CORS configuration
- `EXPO_PUBLIC_DOMAIN` — Public domain for API URL construction in the client
- `REPLIT_DOMAINS` — Additional allowed CORS origins
- `REPLIT_INTERNAL_APP_DOMAIN` — Used in production build for deployment domain
