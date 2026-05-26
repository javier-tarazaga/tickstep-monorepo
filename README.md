# TickStep

A cross-platform task management app with desktop, mobile, and API support. Built as a monorepo with shared types and utilities across all platforms.

## Project Structure

```
tickstep-monorepo/
├── apps/
│   ├── api/          # NestJS backend API
│   ├── desktop/      # Electron + React desktop app
│   └── mobile/       # React Native (Expo) mobile app
├── packages/
│   ├── api-client/   # TypeScript HTTP client
│   ├── shared-types/ # Shared TypeScript interfaces
│   └── shared-utils/ # Shared utility functions
└── scripts/
    └── init-db.sql   # PostgreSQL schema
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS, PostgreSQL, Supabase Auth |
| Desktop | React 19, Electron, Vite |
| Mobile | React Native, Expo |
| State | Zustand |
| Build | Turborepo, pnpm |
| Language | TypeScript |

## Prerequisites

- Node.js 18+
- pnpm 10+
- Docker (for local PostgreSQL)

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start the database**

   ```bash
   docker compose up -d
   ```

3. **Run all apps in development mode**

   ```bash
   pnpm dev
   ```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all code |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Clean build artifacts |
