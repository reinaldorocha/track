# UTM-Track Build Tasks

## Phase 1 — Scaffolding & Core
- [x] Initialize Next.js 16 project with TypeScript
- [x] Install all dependencies (Prisma, NextAuth v5, Recharts, Zod, TanStack Query, Lucide, Tailwind v4, etc.)
- [x] Configure Tailwind CSS & Dark/Light theming
- [x] Create Prisma schema with all 24+ entities
- [x] Set up database + run migrations (SQLite dev / PostgreSQL prod ready)
- [x] Configure NextAuth.js v5 with credentials and Prisma adapter

## Phase 2 — Layout & Navigation
- [x] Create app layout (sidebar + header + dark mode)
- [x] Create sidebar with full menu structure matching specification
- [x] Create header with dark mode toggle & user menu
- [x] Create auth pages (login, register)
- [x] Create landing/home redirect logic
- [x] Create proxy/middleware route protection

## Phase 3 — Dashboard
- [x] Create main dashboard page & content wrapper
- [x] Create metric cards component with tooltips & comparisons
- [x] Create visual funnel chart with drop rates & step costs
- [x] Create period selector (Hoje, Ontem, 7d, 30d, Este mês, Mês anterior, Customizado)
- [x] Create advanced dashboard & app status pages
- [x] Create metrics calculator lib with division-by-zero protection

## Phase 4 — Meta Ads Integration
- [x] Create Meta API client (Graph API v21.0)
- [x] Create Meta OAuth flow & callback receiver
- [x] Create Meta Insights & hierarchy sync (accounts, campaigns, adsets, ads)
- [x] Create Meta Ads pages & management tables
- [x] Create sync trigger endpoint & logs

## Phase 5 — Tracking System
- [x] Create tracker.js lightweight client-side script (<3KB, async, non-blocking)
- [x] Create tracking event API endpoint with deduplication
- [x] Create session management with cookies fbp, fbc, fbclid, and UTM extraction
- [x] Create UTM link builder interface & history
- [x] Create tracker installation walkthrough (5 steps)

## Phase 6 — Pixel & CAPI
- [x] Create Meta Pixel integration interface
- [x] Create Conversions API (CAPI) client with SHA-256 hashing
- [x] Create pixel management UI with test connection & code generator
- [x] Encrypt access tokens at rest (AES-256-GCM) and mask on UI

## Phase 7 — Platform Integrations
- [x] Create Hotmart webhook handler with hottok validation
- [x] Create Yampi webhook handler with order status mapping
- [x] Create Shopify webhook handler with HMAC-SHA256 validation
- [x] Create Cacto webhook handler with signature validation
- [x] Create generic webhook system with dynamic endpoints
- [x] Create integrations hub page
- [x] Create sale normalizer with upsert & attribution trigger

## Phase 8 — Attribution Engine
- [x] Create session-sale matcher with confidence levels
- [x] Create last-click attribution algorithm
- [x] Create attribution records persistence & linking
- [x] Prevent spurious attribution when data is insufficient

## Phase 9 — Financial Module
- [x] Create financial calculations (Gross/Net Revenue, Profit, Margin, ROAS, ROI)
- [x] Create expenses management page with full CRUD, categories & recurrences
- [x] Create fees management page with percentage & fixed fee configurations
- [x] Create rules and operations views

## Phase 10 — Reports, Events, Notifications
- [x] Create events stream page with audit details
- [x] Create notifications system for sales and alerts
- [x] Create summary and reports pages

## Phase 11 — Tests & Docs
- [x] Create metric unit tests (CPM, CPC, CTR, CPI, CPA, ROAS, ROI, Margem, Lucro)
- [x] Create tracking & UTM unit tests
- [x] Create attribution logic unit tests
- [x] Create webhook & idempotency unit tests
- [x] Run test suite (`npm test`) — 21 tests passing 100%
- [x] Run type-check (`npm run type-check`) — 0 errors
- [x] Run production build (`npm run build`) — 44 routes compiled successfully
- [x] Create database seed (`npm run db:seed`) with realistic demo data
- [x] Create comprehensive documentation (README.md, ARCHITECTURE.md, INTEGRATIONS.md, TRACKING.md, DATABASE.md)
