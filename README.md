# StagePass — Real-Time Event Ticketing & Live Streaming Platform

> A production-grade, cloud-native platform for browsing events, booking seats with live availability, processing payments, and attending events via low-latency live streams — all in one unified experience.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Services](#services)
  - [Frontend (Next.js)](#frontend-nextjs--port-3000)
  - [Booking Service](#booking-service--port-3001)
  - [Payment Service](#payment-service--port-3002)
  - [Streaming Service](#streaming-service--port-3003)
  - [WebSocket Server](#websocket-server--port-4000)
- [Database Design](#database-design)
- [Real-Time Architecture](#real-time-architecture)
- [Payment Orchestration](#payment-orchestration)
- [Live Streaming Architecture](#live-streaming-architecture)
- [Authentication Flow](#authentication-flow)
- [Infrastructure](#infrastructure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Phases](#project-phases)

---

## Overview

StagePass solves three hard problems that traditional ticketing platforms get wrong:

1. **Stale seat maps** — Users click a seat, get told it's already taken. StagePass pushes seat state changes to every connected browser in under 300ms via WebSockets with atomic DynamoDB conditional writes preventing any double-booking.

2. **Fragile payment flows** — A timeout after charging but before issuing the ticket leaves the user in limbo. StagePass uses AWS Step Functions to orchestrate every payment step as a visible state machine with automatic retries and compensating transactions.

3. **No virtual attendance** — StagePass integrates LiveKit (WebRTC) for low-latency live streaming with per-user playback token authorization, so only ticket holders can watch.

### What's Built

| Feature | Implementation |
|---|---|
| Real-time seat map | WebSocket pub/sub + DynamoDB conditional writes |
| Double-booking prevention | Atomic `ConditionExpression` on every hold attempt |
| Payment flow | AWS Step Functions (8-state machine) + Razorpay |
| Live streaming | LiveKit WebRTC with RTMP ingress for OBS |
| Live chat | WebSocket channels + DynamoDB persistence + ticket-holder badges |
| Auth | AWS Cognito (JWT, refresh tokens, JWKS verification) |
| Infrastructure | Terraform-managed AWS (DynamoDB, Cognito, Step Functions, SES, IAM) |
| Database | Supabase PostgreSQL (Prisma ORM) + Upstash Redis |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Next.js)                    │
│  SSR pages · Client WebSocket · LiveKit player           │
└──────────────────┬──────────────────┬───────────────────┘
                   │ HTTP (BFF)        │ WebSocket
         ┌─────────▼─────────┐  ┌─────▼──────────┐
         │  Next.js API       │  │   WS Server     │
         │  Routes (BFF)      │  │   Port 4000     │
         └──┬───┬─────┬───┬──┘  └────────┬────────┘
            │   │     │   │               │
     ┌──────▼┐ ┌▼───┐ ┌▼──────┐  ┌───────▼──────┐
     │Booking│ │Pay │ │Stream │  │  DynamoDB     │
     │:3001  │ │:3002│ │:3003  │  │  Chat Table  │
     └───┬───┘ └──┬─┘ └───┬───┘  └──────────────┘
         │        │       │
    ┌────▼───┐ ┌──▼────┐ ┌▼─────────┐
    │DynamoDB│ │Step   │ │LiveKit   │
    │  seats │ │Fns    │ │Cloud     │
    │Supabase│ │Razorpay│ │(WebRTC) │
    │  PG    │ └───────┘ └──────────┘
    │Upstash │
    │ Redis  │
    └────────┘
```

### Key Design Decisions

**Why DynamoDB for seats, not PostgreSQL?**
DynamoDB's `ConditionExpression` provides native atomic conditional writes. Two users clicking the same seat simultaneously — only one write succeeds. The loser gets an immediate `ConditionalCheckFailedException`. No distributed locks, no queuing, single-digit millisecond latency at any scale.

**Why Step Functions for payments?**
A payment involves 6+ steps across external services. If the process crashes after charging but before recording the order, the user is charged with no ticket. Step Functions makes every transition persistent and auditable. Failed steps retry automatically. Compensation states (refund/release seat) run on definitive failure.

**Why WebSocket server over API Gateway WebSocket?**
Full control over connection state, channel subscription logic, and chat message broadcasting — all in one process. Simpler than wiring Lambda + DynamoDB connections table for a portfolio-scale project, and easier to debug locally.

**Why LiveKit over Amazon IVS?**
LiveKit uses WebRTC which gives sub-second latency vs IVS's 3–5 second HLS latency. RTMP ingress allows OBS to stream directly. The server SDK makes creating access tokens and managing rooms straightforward.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js 20 + TypeScript | All microservices |
| Express.js | HTTP server for each service |
| Prisma ORM | PostgreSQL access (booking-service) |
| AWS SDK v2 | DynamoDB, Cognito, Step Functions, SES |
| `ws` library | WebSocket server |
| `jsonwebtoken` + `jwks-rsa` | JWT verification against Cognito JWKS |
| Razorpay SDK | Payment processing |
| LiveKit Server SDK | Stream tokens, ingress, webhooks |
| Upstash Redis | Seat hold TTL, rate limiting |

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 14 (App Router) | SSR/SSG pages + BFF API routes |
| React 18 | UI |
| TypeScript | Type safety |
| Tailwind CSS + shadcn/ui | Styling and components |
| `livekit-client` | WebRTC video/audio player |
| `jose` | JWT verification in Next.js middleware |

### Infrastructure & Cloud
| Technology | Purpose |
|---|---|
| AWS Cognito | User authentication, JWT issuance |
| AWS DynamoDB | Seat inventory, stream state, chat messages, payment tasks |
| AWS Step Functions | Payment workflow orchestration |
| AWS SES | Transactional email |
| AWS IAM | Roles and policies for Lambda + Step Functions |
| AWS Lambda | Confirm booking, send email, expire holds |
| Supabase PostgreSQL | Events, users, venues, bookings, price tiers |
| Upstash Redis | Seat hold TTL |
| LiveKit Cloud | Live streaming (WebRTC + RTMP ingress) |
| Terraform | IaC for all AWS resources |
| pnpm workspaces | Monorepo management |

---

## Project Structure

```
StagePass/
├── frontend/                          # Next.js 14 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Home / event discovery
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── auth/                  # Login, signup, verify pages
│   │   │   ├── events/[id]/           # Event detail + seat selection
│   │   │   ├── checkout/              # Payment checkout
│   │   │   ├── booking/[id]/          # Booking confirmation
│   │   │   ├── stream/[event_id]/     # Live stream viewer
│   │   │   └── api/                   # BFF API routes
│   │   │       ├── auth/              # login, signup, verify, refresh, logout
│   │   │       ├── bookings/          # hold, my bookings, release
│   │   │       ├── events/            # list, detail, seats
│   │   │       ├── payments/          # create-order
│   │   │       ├── streams/           # status, token, chat
│   │   │       └── ws/auth/           # WebSocket auth token
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── MyBookings.tsx
│   │   │   ├── seat-map/              # SeatMap, SeatCell, HoldTimer
│   │   │   ├── stream/                # StreamPlayer, ChatPanel, ChatMessage, StreamStatusBanner
│   │   │   └── ui/                    # shadcn/ui primitives
│   │   ├── lib/                       # auth helpers, utils
│   │   └── middleware.ts              # Cognito JWT auth middleware (all /api/* routes)
│   ├── .env.local                     # Frontend environment variables
│   └── Dockerfile
│
├── backend/
│   ├── services/
│   │   ├── booking-service/           # Seat inventory + real-time holds (port 3001)
│   │   │   ├── src/
│   │   │   │   ├── controllers/       # BookingController, EventController, SeatController
│   │   │   │   ├── services/          # BookingService, SeatService, WsService
│   │   │   │   ├── repositories/      # BookingRepository, SeatRepository, RedisRepository
│   │   │   │   ├── routes/            # booking, event, seat, health routes
│   │   │   │   ├── middleware/        # auth, error middleware
│   │   │   │   └── clients/           # dynamo, prisma, redis clients
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma      # User, Venue, Event, PriceTier, Booking models
│   │   │   │   └── seed.ts            # Development seed data
│   │   │   ├── scripts/
│   │   │   │   └── create-dynamo-tables.ts
│   │   │   └── .env
│   │   │
│   │   ├── payment-service/           # Payment orchestration (port 3002)
│   │   │   ├── src/
│   │   │   │   ├── routes/            # orders, webhook routes
│   │   │   │   ├── lib/               # razorpay, dynamo, stepfunctions wrappers
│   │   │   │   └── config.ts
│   │   │   └── .env
│   │   │
│   │   ├── streaming-service/         # Live stream management (port 3003)
│   │   │   ├── src/
│   │   │   │   ├── controllers/       # StreamController (status, token, chat, webhook)
│   │   │   │   ├── services/          # StreamService
│   │   │   │   ├── repositories/      # StreamRepository, BookingRepository
│   │   │   │   ├── lib/               # livekit.ts (token generation)
│   │   │   │   ├── middleware/        # auth.middleware (Cognito JWKS)
│   │   │   │   └── clients/           # dynamo, pg clients
│   │   │   ├── scripts/
│   │   │   │   ├── seed-stream-state.ts   # Seed event stream state in DynamoDB
│   │   │   │   └── create-ingress.ts      # Create LiveKit RTMP ingress
│   │   │   └── .env
│   │   │
│   │   └── ws-server/                 # WebSocket pub/sub + chat (port 4000)
│   │       ├── src/
│   │       │   └── index.ts           # WS server, channel subscriptions, chat persistence
│   │       └── .env
│   │
│   ├── shared/                        # Shared TypeScript types
│   │   └── types.ts                   # Seat, SeatRow, HoldRequest/Response, WsBroadcastPayload
│   │
│   └── docker-compose.yml             # Local dev: DynamoDB Local, PostgreSQL, Redis
│
├── infra/
│   ├── terraform/
│   │   ├── main.tf                    # AWS provider
│   │   ├── variables.tf               # Input variables
│   │   ├── outputs.tf                 # Outputs (Cognito pool ID, client ID, etc.)
│   │   ├── cognito.tf                 # User Pool + App Client
│   │   ├── dynamodb.tf                # payment_tasks table
│   │   ├── streaming.tf               # stream_state + chat_messages tables
│   │   ├── stepfunctions.tf           # Payment workflow state machine
│   │   ├── iam.tf                     # Lambda + Step Functions roles
│   │   └── ses.tf                     # SES email identity
│   └── lambdas/
│       ├── confirm-booking/           # Confirms booking after payment
│       ├── send-email/                # Sends confirmation email via SES
│       ├── expire-hold/               # Releases expired seat holds
│       └── update-stream-state/       # Updates stream state on IVS events
│
└── docs/
    └── superpowers/
        ├── specs/                     # Design documents for each phase
        └── plans/                     # Implementation plans for each phase
```

---

## Services

### Frontend (Next.js) — Port 3000

The frontend is a Next.js 14 App Router application that serves as both the user interface and the Backend-for-Frontend (BFF) layer.

**Rendering Strategy:**
- **SSG/ISR** — Event listing and detail pages. Pre-rendered for SEO and served from CDN.
- **SSR** — User dashboard, booking history. User-specific data.
- **Client-side** — Seat map, live stream page. Real-time WebSocket state.

**BFF API Routes** (`/src/app/api/`):
The Next.js middleware (`middleware.ts`) intercepts all `/api/*` requests. It verifies the Cognito JWT from the `access_token` cookie, injects `x-user-id`, `x-user-email`, and `x-access-token` headers, and forwards to the route handler. Route handlers proxy to microservices.

Public routes (no auth required): `/api/auth/*`, `/api/streams/:id`, `/api/streams/:id/chat`

**Key Pages:**
| Page | Description |
|---|---|
| `/` | Event listing with upcoming shows |
| `/events/[id]` | Event detail, pricing tiers, "Book Now" CTA |
| `/events/[id]/seats` | Live seat map with WebSocket real-time updates |
| `/checkout` | Razorpay payment form |
| `/booking/[id]` | Booking confirmation with QR ticket |
| `/stream/[event_id]` | Live stream player + chat panel |

---

### Booking Service — Port 3001

Owns seat inventory and reservations. The most critical service in the system — handles the concurrent booking problem.

**Endpoints:**
```
GET  /healthz                           Health check
GET  /api/events                        List all events
GET  /api/events/:id                    Event detail
GET  /api/events/:id/seats              Seat map for a show
POST /api/bookings/hold                 Hold a seat (atomic conditional write)
DELETE /api/bookings/hold/:seat_id      Release a held seat
GET  /api/bookings/my                   User's confirmed bookings
GET  /api/bookings/:id                  Booking detail
POST /api/bookings/confirm              Confirm held seats after payment
```

**The Core: Atomic Seat Hold**

```typescript
// Only succeeds if status is currently AVAILABLE
// ConditionalCheckFailedException = someone else got it first
await dynamo.update({
  TableName: 'dev_seats',
  Key: { show_id, seat_id },
  UpdateExpression: 'SET #s = :held, held_by = :uid, hold_expires_at = :exp',
  ConditionExpression: '#s = :available',
  ExpressionAttributeValues: {
    ':held': 'HELD',
    ':available': 'AVAILABLE',
    ':uid': userId,
    ':exp': Math.floor(Date.now() / 1000) + 60,
  }
})
```

After a successful hold, the booking service broadcasts a `SEAT_HELD` event to the WebSocket server via HTTP, which pushes it to all browsers on the same show page.

**Seat States:**
```
AVAILABLE → (user clicks) → HELD → (payment confirmed) → BOOKED
                             ↓ (TTL expires or payment fails)
                          AVAILABLE
```

---

### Payment Service — Port 3002

Handles the complete payment lifecycle via AWS Step Functions orchestration.

**Endpoints:**
```
POST /api/payments/create-order         Create Razorpay order + start Step Functions
POST /api/payments/webhook              Razorpay webhook handler (payment verification)
GET  /healthz                           Health check
```

**Step Functions Workflow (8 states):**

```
ValidateHold → ChargePayment → RecordOrder → ConfirmSeats
                    ↓ (failure)       ↓
             PaymentFailed      GenerateTicket → NotifyUser → Success
             Compensation
                    ↓
             ReleaseHold → Failure
```

| State | Action |
|---|---|
| `ValidateHold` | Check seat hold is still valid and held by this user |
| `ChargePayment` | Call Razorpay; auto-retry 3x with exponential backoff on transient errors |
| `PaymentFailedCompensation` | On definitive failure — release seat hold back to AVAILABLE |
| `RecordOrder` | Write confirmed order to PostgreSQL |
| `ConfirmSeats` | Update DynamoDB seats from HELD → BOOKED (conditional write) |
| `GenerateTicket` | Generate QR code JWT, upload to S3 |
| `NotifyUser` | Publish to SNS → SES confirmation email |
| `Success` | Return booking reference + ticket URL |

Every state transition is logged in AWS. If the Lambda crashes mid-execution, Step Functions retries from the last recorded state. The user is never charged without a ticket, and a ticket is never issued without a charge.

---

### Streaming Service — Port 3003

Manages live stream lifecycle and provides secure playback access to ticket holders.

**Endpoints:**
```
GET  /healthz                           Health check
GET  /api/streams/:event_id             Stream status (PUBLIC — no auth required)
GET  /api/streams/:event_id/token       LiveKit playback token (auth required, booking verified)
GET  /api/streams/:event_id/chat        Chat history — last 100 messages (PUBLIC)
POST /api/streams/webhook               LiveKit webhook (room_started / room_finished)
```

**Stream Status Flow:**
```
UPCOMING → (OBS starts streaming via RTMP ingress) → LIVE → (OBS stops) → ENDED
                          ↑
                  LiveKit webhook fires
                  → DynamoDB status updated
                  → Frontend polling picks it up
```

**Playback Token Authorization:**
When a user opens the stream page, the frontend requests a token from `/api/streams/:id/token`. The service:
1. Verifies the Cognito JWT (JWKS RS256)
2. Checks the user has a `CONFIRMED` booking for this event in PostgreSQL
3. If verified, generates a LiveKit `AccessToken` (JWT signed with LiveKit API secret, `canSubscribe: true`, 12h TTL)
4. Returns `{ token }` — the browser passes this to the LiveKit client SDK to connect

Users without a confirmed booking receive `403 Forbidden`.

**LiveKit Webhook:**
The webhook endpoint receives signed HTTP POST events from LiveKit Cloud when a room starts or ends. The raw request body is verified using `WebhookReceiver` (HMAC signature check). On `room_started`, DynamoDB is updated to `LIVE`. On `room_finished`, to `ENDED`.

> Note: The webhook route is registered before `express.json()` middleware to preserve the raw body needed for signature verification.

**Scripts:**
```bash
# Seed initial stream state for EVT-001 (status: UPCOMING)
npm run seed

# Create a LiveKit RTMP ingress for EVT-001
# Prints the RTMP URL + stream key for OBS
npm run create-ingress
```

---

### WebSocket Server — Port 4000

A single-process Node.js WebSocket server handling real-time seat updates, chat subscriptions, and chat message persistence.

**Connection flow:**
1. Frontend calls `GET /api/ws/auth` (Next.js BFF) → returns short-lived JWT (`sub`, `email`)
2. Frontend opens WebSocket: `ws://localhost:4000?token=<jwt>`
3. Server verifies JWT using `JWT_SECRET`
4. Client sends `{ action: "subscribe", channel: "show:EVT-001#2026-04-01#19:00" }` for seat updates
5. Client sends `{ action: "subscribe", channel: "chat:EVT-001" }` for live chat

**Channels:**
| Channel prefix | Purpose |
|---|---|
| `show:` | Seat state broadcasts (SEAT_HELD, SEAT_AVAILABLE, SEAT_BOOKED) |
| `chat:` | Live chat messages |
| `user:` | Per-user private messages |

**Chat Message Handling:**
When a client sends `{ action: "chat", channel: "chat:EVT-001", message: "..." }`:
1. Message trimmed and validated (1–300 characters)
2. `event_id` extracted from channel (`chat:EVT-001` → `EVT-001`)
3. Ticket holder status verified via PostgreSQL query on `Booking` table
4. Message persisted to DynamoDB `dev_chat_messages` with `ts_id = ISO#UUID`, 7-day TTL
5. `CHAT_MESSAGE` payload broadcast to all subscribers on `chat:EVT-001`

**Broadcast endpoint (internal):**
```
POST /broadcast     { channel, payload }     — used by booking-service for seat updates
```

---

## Database Design

### PostgreSQL (Supabase) — via Prisma ORM

Used for relational data requiring ACID guarantees.

```prisma
model User {
  id          String    @id @default(cuid())
  cognito_id  String    @unique
  email       String    @unique
  first_name  String
  last_name   String
  phone       String?
  bookings    Booking[]
}

model Event {
  id           String      @id @default(cuid())
  title        String
  description  String
  venue        Venue       @relation(fields: [venue_id], references: [id])
  venue_id     String
  start_at     DateTime
  end_at       DateTime
  status       String      // DRAFT | PUBLISHED | CANCELLED
  organizer_id String
  price_tiers  PriceTier[]
  bookings     Booking[]
}

model Booking {
  id                String   @id @default(cuid())
  user_id           String
  event_id          String
  show_id           String   // "{event_id}#{date}#{time}"
  seats             String[] // seat IDs array
  status            String   // HELD | CONFIRMED | CANCELLED
  held_until        DateTime?
  payment_intent_id String?
}
```

### DynamoDB Tables

| Table | Partition Key | Sort Key | Purpose |
|---|---|---|---|
| `dev_seats` | `show_id` | `seat_id` | Seat state (AVAILABLE/HELD/BOOKED/BLOCKED) |
| `dev_payment_tasks` | `razorpay_order_id` | — | Payment workflow state, TTL for cleanup |
| `dev_stream_state` | `event_id` | — | Stream status, went_live_at, vod_url |
| `dev_chat_messages` | `event_id` | `ts_id` | Chat history, 7-day TTL |

**`dev_seats` item structure:**
```json
{
  "show_id": "EVT-001#2026-04-01#19:00",
  "seat_id": "A12",
  "status": "HELD",
  "held_by": "cognito-user-sub-uuid",
  "hold_expires_at": 1774122597,
  "price_tier": "PREMIUM"
}
```

**`dev_stream_state` item structure:**
```json
{
  "event_id": "EVT-001",
  "status": "LIVE",
  "room_name": "EVT-001",
  "went_live_at": 1774122537,
  "vod_url": null
}
```

### Redis (Upstash)

Used for seat hold TTL as a reliable 60-second expiry mechanism (DynamoDB TTL can delay up to 48 hours).

```
Key: dev:hold:{show_id}:{seat_id}
TTL: 60 seconds
Value: userId
```

On Redis key expiry → Lambda fires → seat released back to `AVAILABLE` in DynamoDB → WebSocket broadcast.

---

## Real-Time Architecture

### Seat Map Updates

```
User clicks seat A12
       │
       ▼
POST /api/bookings/hold
       │
       ▼
DynamoDB conditional write
(fails if status ≠ AVAILABLE)
       │ success
       ▼
POST http://ws-server:4000/broadcast
{ channel: "show:EVT-001#...", payload: { type: "SEAT_HELD", seat_id: "A12" } }
       │
       ▼
WS Server iterates all connections subscribed to "show:EVT-001#..."
       │
       ▼
Every browser on this show's seat map sees A12 turn gray
Total time: < 300ms
```

### Live Chat

```
User types message, hits Send
       │
       ▼
WS: { action: "chat", channel: "chat:EVT-001", message: "hello" }
       │
       ▼
ws-server validates message (length, channel format)
       │
       ▼
Postgres query: has CONFIRMED booking? → is_ticket_holder boolean
       │
       ▼
DynamoDB PUT: { event_id, ts_id, user_id, display_name, message, is_ticket_holder, ttl }
       │
       ▼
Broadcast CHAT_MESSAGE to all "chat:EVT-001" subscribers
       │
       ▼
All viewers see the message instantly
Ticket holders shown with 🎫 badge
```

---

## Payment Orchestration

### Full Booking Flow (Happy Path)

```
1.  User selects seats → POST /api/bookings/hold
2.  DynamoDB conditional write: seats → HELD (60s window)
3.  User fills payment form → POST /api/payments/create-order
4.  Payment service creates Razorpay order → starts Step Functions execution
5.  Step Functions: ValidateHold ✓
6.  Step Functions: ChargePayment → Razorpay charges card ✓
7.  Step Functions: RecordOrder → writes to PostgreSQL ✓
8.  Step Functions: ConfirmSeats → DynamoDB HELD → BOOKED ✓
9.  Step Functions: GenerateTicket → QR code JWT → S3 ✓
10. Step Functions: NotifyUser → SNS → SES email with QR code ✓
11. Frontend polls → booking confirmed → redirect to confirmation page
```

### Failure + Compensation Flow

```
5.  ChargePayment fails (card declined)
       │
       ▼
6.  PaymentFailedCompensation:
    - Booking service: seat HELD → AVAILABLE
    - WebSocket broadcast: seat turns green for all users
    - Email to user: "Payment failed, seat released"
       │
       ▼
7.  User is NOT charged. Seat is available again.
```

---

## Live Streaming Architecture

### Broadcaster Setup (OBS)

```
OBS Studio
  │  RTMP stream
  ▼
LiveKit Ingress (RTMP endpoint)
  │  WebRTC
  ▼
LiveKit Cloud Room "EVT-001"
  │  WebRTC tracks
  ▼
Browser viewers (livekit-client SDK)
```

### Viewer Access Flow

```
1. User opens /stream/EVT-001
2. Frontend polls GET /api/streams/EVT-001 every 10s
3. When status = LIVE → fetch playback token
4. GET /api/streams/EVT-001/token
   ├── Next.js middleware injects x-access-token header
   ├── Streaming service verifies Cognito JWT (JWKS)
   ├── Check Postgres: confirmed booking for EVT-001?
   ├── YES → generate LiveKit AccessToken (canSubscribe: true, 12h)
   └── Return { token }
5. Frontend: new Room().connect(LIVEKIT_URL, token)
6. Subscribe to video + audio tracks → display in <video> element
```

### Webhook-Driven Status Updates

```
OBS starts stream
  │
  ▼
LiveKit Cloud → POST https://<ngrok>/api/streams/webhook
  │  (HMAC signed, verified by WebhookReceiver)
  ▼
streaming-service: DynamoDB update EVT-001 status → LIVE, went_live_at = now
  │
  ▼
Frontend polling picks up LIVE status within 10 seconds
  │
  ▼
Player renders automatically
```

---

## Authentication Flow

### Cognito JWT Verification

```
Browser                Next.js Middleware           Service
   │                         │                        │
   │── GET /api/bookings/my ─▶│                        │
   │   Cookie: access_token   │                        │
   │                          │── verify JWT (JWKS) ──▶│ Cognito JWKS
   │                          │◀─ { sub, email } ──────│
   │                          │                        │
   │                          │── inject headers ──────▶│
   │                          │   x-user-id: sub        │
   │                          │   x-user-email: email   │
   │                          │   x-access-token: jwt   │
   │                          │                        │
   │◀─── response ────────────│◀─── response ──────────│
```

**Token lifecycle:**
- `access_token` (httpOnly cookie, 1h) — used for all API calls
- `refresh_token` (httpOnly cookie, 30d) — silently refreshes expired access tokens
- Middleware attempts refresh automatically; user never sees an expired-token error

**WebSocket auth:**
The WS connection cannot carry cookies. Instead:
1. `GET /api/ws/auth` (authenticated BFF route) mints a short-lived JWT: `{ sub, email }` signed with `JWT_SECRET`
2. Frontend connects: `ws://localhost:4000?token=<jwt>`
3. WS server verifies with same `JWT_SECRET`
4. `email` is used for `display_name` in chat (e.g., `varshil@example.com` → `varshil`)

---

## Infrastructure

### Terraform-Managed AWS Resources

```bash
cd infra/terraform
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

**Provisioned resources:**

| Resource | File | Purpose |
|---|---|---|
| Cognito User Pool | `cognito.tf` | User auth, JWT issuance |
| Cognito App Client | `cognito.tf` | Client ID for frontend |
| DynamoDB `dev_payment_tasks` | `dynamodb.tf` | Payment workflow state |
| DynamoDB `dev_stream_state` | `streaming.tf` | Stream status |
| DynamoDB `dev_chat_messages` | `streaming.tf` | Chat persistence |
| Step Functions State Machine | `stepfunctions.tf` | Payment orchestration |
| Lambda: confirm-booking | `stepfunctions.tf` | Confirms booking |
| Lambda: send-email | `stepfunctions.tf` | SES email |
| Lambda: expire-hold | `stepfunctions.tf` | Releases expired holds |
| IAM roles/policies | `iam.tf` | Lambda + Step Functions permissions |
| SES email identity | `ses.tf` | Transactional email |

### Lambda Functions

| Lambda | Trigger | Action |
|---|---|---|
| `confirm-booking` | Step Functions | Marks booking CONFIRMED in PostgreSQL |
| `send-email` | Step Functions / SNS | Sends confirmation email via SES |
| `expire-hold` | Redis TTL expiry | Releases HELD seat back to AVAILABLE |
| `update-stream-state` | (legacy IVS) | Updates stream status |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- AWS account (free tier sufficient)
- Supabase account (free tier)
- Upstash Redis account (free tier)
- LiveKit Cloud account (free tier)
- Razorpay account (test mode)

### 1. Clone and Install

```bash
git clone <repo-url>
cd StagePass
pnpm install
```

### 2. Provision AWS Infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in your AWS credentials and settings
terraform init
terraform apply
# Note the outputs: cognito_user_pool_id, cognito_client_id
```

### 3. Configure Environment Variables

Copy and fill each service's `.env` file (see [Environment Variables](#environment-variables) section below).

### 4. Set Up the Database

```bash
# Run Prisma migrations + seed events/venues/price tiers
pnpm db:setup

# Create DynamoDB tables (dev_seats)
pnpm --filter booking-service dynamo:create

# Seed initial stream state
pnpm --filter streaming-service seed
```

### 5. Start All Services

```bash
# Start frontend + booking-service + ws-server in parallel
pnpm dev

# In separate terminals:
cd backend/services/payment-service && npm run dev
cd backend/services/streaming-service && npm run dev
```

### 6. Set Up Live Streaming (Optional)

```bash
cd backend/services/streaming-service

# Create a LiveKit RTMP ingress for EVT-001
# Prints RTMP URL + stream key for OBS
npm run create-ingress
```

Then in OBS: Settings → Stream → Custom → paste the RTMP URL and stream key.

For webhooks: run `ngrok http 3003` and register `https://<ngrok-url>/api/streams/webhook` in the LiveKit Cloud dashboard.

### 7. Open the App

```
http://localhost:3000
```

Sign up, verify email, browse events, select seats, and book tickets.

---

## Environment Variables

### Booking Service (`backend/services/booking-service/.env`)

```env
DATABASE_URL="postgresql://..."          # Supabase connection pooler URL
DIRECT_URL="postgresql://..."            # Supabase direct URL (for Prisma migrations)
UPSTASH_REDIS_URL="rediss://..."         # Upstash Redis URL
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
TABLE_PREFIX=dev_
REDIS_KEY_PREFIX=dev:
INTERNAL_API_SECRET=dev-internal-secret-2026
JWT_SECRET=dev-secret-123
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=...
NODE_ENV=development
LOG_LEVEL=debug
WS_MODE=local                            # local = HTTP to ws-server, sns = SNS topic
WS_SERVER_URL=http://localhost:4000
PORT=3001
```

### Payment Service (`backend/services/payment-service/.env`)

```env
PORT=3002
NODE_ENV=development
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
TABLE_PREFIX=dev_
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
STEP_FUNCTIONS_STATE_MACHINE_ARN=arn:aws:states:...
BOOKING_SERVICE_URL=http://localhost:3001
INTERNAL_API_SECRET=dev-internal-secret-2026
JWT_SECRET=dev-secret-123
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_...
```

### Streaming Service (`backend/services/streaming-service/.env`)

```env
PORT=3003
NODE_ENV=development
DATABASE_URL="postgresql://..."
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
TABLE_PREFIX=dev_
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-app.livekit.cloud
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_...
JWT_SECRET=dev-secret-123
LOG_LEVEL=debug
```

### WebSocket Server (`backend/services/ws-server/.env`)

```env
PORT=4000
JWT_SECRET=dev-secret-123              # Must match booking-service and frontend
DATABASE_URL="postgresql://..."        # For ticket holder verification
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
TABLE_PREFIX=dev_
NODE_ENV=development
```

### Frontend (`frontend/.env.local`)

```env
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=...
JWT_SECRET=dev-secret-123              # Must match ws-server
BOOKING_SERVICE_URL=http://localhost:3001
PAYMENT_SERVICE_URL=http://localhost:3002
STREAMING_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
```

> **Critical:** `JWT_SECRET` must be identical across `booking-service`, `payment-service`, `streaming-service`, `ws-server`, and `frontend`. This JWT is used for WebSocket authentication.

> **Critical:** `INTERNAL_API_SECRET` must match between `booking-service`, `payment-service`, and the Terraform-deployed Lambda functions.

---

## Project Phases

### Phase 1 — Core Booking ✅
Real-time seat selection with WebSocket updates and atomic hold logic.

**Milestone:** Two browser tabs on the same seat map. Click a seat in Tab 1. Tab 2 sees it gray in under one second.

### Phase 2 — Payment ✅
Complete booking flow with Razorpay + AWS Step Functions orchestration, QR code ticket generation, and SES confirmation email.

**Milestone:** Full end-to-end booking. Hold a seat, enter test card, receive confirmation email with QR code.

### Phase 3 — Live Streaming ✅
LiveKit WebRTC streaming with OBS RTMP ingress, ticket-gated playback tokens, live chat with DynamoDB persistence, and webhook-driven stream state management.

**Milestone:** Stream OBS output into LiveKit. Open stream page as a ticket holder. Watch stream with live chat. Stop stream, status flips to ENDED.

### Phase 4 — Observability & Polish (Planned)
Prometheus + Grafana + Loki monitoring stack, geohash-based event discovery, organizer dashboard, k6 load testing, demo recording.

**Milestone:** Grafana dashboard showing live metrics during a simulated booking load test.

---

## Key Concepts for Understanding the Codebase

### The Concurrent Booking Problem
Two users click the same seat simultaneously. Without protection, both succeed and the seat is double-booked. Solution: DynamoDB `ConditionExpression: 'status = AVAILABLE'`. Only one write can succeed — the other throws `ConditionalCheckFailedException` and receives a 409.

### Why Compensation Instead of Rollback
Distributed systems have no global transaction. If payment succeeds but seat confirmation fails, you cannot rollback the charge atomically. Instead, a compensation state explicitly issues a refund and releases the seat. The system converges to consistency through forward-moving compensating actions.

### WebSocket Channel Isolation
Seat updates for show A must not be broadcast to users viewing show B. Each WS connection subscribes to a specific channel (`show:EVT-001#2026-04-01#19:00`). The ws-server maintains a `Map<channel, Set<WebSocket>>` and iterates only the relevant connections on each broadcast.

### BFF Pattern
The frontend never calls microservices directly. All calls go through Next.js API routes which (a) verify the user's Cognito token, (b) inject user identity headers, and (c) proxy to the appropriate microservice. Services trust `x-user-id` because it can only be set by the BFF, which already validated the JWT.

---

*Built to understand distributed systems, not just CRUD.*
