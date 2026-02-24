# PillMate - Medication Tracking App

## Overview

PillMate is a medication tracking mobile application built with Expo (React Native) and an Express backend. It helps users manage their daily medication schedules by allowing them to add medications with specific dosage details and timing, track doses taken (with optional photo verification), and view history/statistics of their medication adherence. The app supports both Korean and English languages.

The project uses a monorepo-style structure with the mobile app (Expo/React Native) in the root and an Express API server in the `server/` directory. Currently, most data is stored client-side using AsyncStorage, with a PostgreSQL database configured via Drizzle ORM on the server side (though server-side storage is minimal at this stage — just a basic user schema).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Mobile App)
- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`)
- **Routing**: expo-router with file-based routing. Three main tabs (Today/Home, Medications, History) plus modal screens for adding medications and taking photos
- **State Management**: React Context (`MedicationContext`, `LanguageContext`) with AsyncStorage for local persistence. TanStack React Query is set up for server API calls but medication data currently lives client-side
- **UI**: Custom components with no external UI library. Uses Inter font family, custom color constants in `constants/colors.ts`, react-native-reanimated for animations, and expo-haptics for tactile feedback
- **Internationalization**: Custom i18n implementation via `LanguageContext` supporting Korean (`ko`) and English (`en`)
- **Key screens**:
  - `app/(tabs)/index.tsx` — Today's schedule with progress ring and schedule cards
  - `app/(tabs)/medications.tsx` — List of all medications with delete capability
  - `app/(tabs)/history.tsx` — Statistics, weekly chart, and completion tracking
  - `app/add-medication.tsx` — Form sheet modal for adding new medications (name, dosage, timing, color)
  - `app/take-photo.tsx` — Camera modal for photo verification when logging a dose

### Backend (Express Server)
- **Framework**: Express 5 running on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **Entry point**: `server/index.ts` — sets up CORS (supports Replit domains and localhost), serves static files in production
- **Routes**: `server/routes.ts` — currently minimal, intended for `/api` prefixed routes
- **Storage**: `server/storage.ts` — uses an in-memory storage class (`MemStorage`) implementing `IStorage` interface. This is the place to add database-backed storage

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — currently defines only a `users` table with id, username, and password. Uses `drizzle-zod` for insert schema validation
- **Config**: `drizzle.config.ts` — requires `DATABASE_URL` environment variable, outputs migrations to `./migrations`
- **Push command**: `npm run db:push` runs `drizzle-kit push` to sync schema to database

### Data Flow
- Medication and dose log data is currently managed entirely on the client via `MedicationContext` + AsyncStorage
- The server infrastructure (Express + Drizzle + PostgreSQL) is in place but underutilized — the architecture is ready for migrating medication data to the server
- `lib/query-client.ts` provides `apiRequest()` and query function utilities for making authenticated API calls to the Express backend

### Build & Deployment
- **Development**: Two processes — `expo:dev` for the mobile app and `server:dev` for the Express server
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
- **AsyncStorage** — Client-side local persistence for medication data
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
- `REPLIT_DEV_DOMAIN` — Used for Expo dev server proxy and CORS configuration
- `EXPO_PUBLIC_DOMAIN` — Public domain for API URL construction in the client
- `REPLIT_DOMAINS` — Additional allowed CORS origins
- `REPLIT_INTERNAL_APP_DOMAIN` — Used in production build for deployment domain