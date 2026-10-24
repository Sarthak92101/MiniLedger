# MiniLedger

Track the money you lend to friends — who owes you what, what is overdue, and
what has been paid back.

MiniLedger is a two-part project:

| Part | Stack | Location |
| --- | --- | --- |
| REST API | Node.js + TypeScript + Express + PostgreSQL | `backend/` |
| Mobile app | React Native (Expo SDK 57) | `mobile/` |

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [The mock OTP](#the-mock-otp)
- [Running the app](#running-the-app)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [Project layout](#project-layout)

---

## Features

**Backend**

- Phone-number login with a mock OTP — the code is printed to the server log
- Create a loan entry (friend name, amount, due date, optional note)
- Mark an entry as repaid (and undo it)
- Summary endpoint: total lent, total repaid, outstanding, overdue amount
- Optional receipt photo upload with type/size validation
- JWT authentication, input validation on every endpoint, consistent error shape

**Mobile**

- Login screen with phone + OTP (two-step)
- Summary card pinned to the top of the home screen
- Entry list with **overdue entries highlighted** in red with a "N days overdue" badge
- Add-entry form with a native date picker, quick presets, and receipt attachment
- Filter tabs for All / Pending / Overdue / Repaid, pull-to-refresh

---

## Architecture

```
┌────────────────────┐        HTTPS / JSON         ┌─────────────────────┐
│  Expo React Native │ ──────────────────────────► │  Express + TS API   │
│  mobile/           │ ◄────────────────────────── │  backend/           │
│                    │      { token, loans, ... }   │                     │
└────────────────────┘                              └──────────┬──────────┘
                                                                  │ SQL
                                                       ┌──────────▼──────────┐
                                                       │    PostgreSQL 16    │
                                                       └─────────────────────┘
```

The backend is a layered Express app:

```
src/
├── app.ts                 # Express app factory (used by the server and the tests)
├── index.ts               # Server bootstrap: migrate → listen → graceful shutdown
├── config/                # Environment configuration, validated on boot
├── db/
│   ├── pool.ts            # pg Pool + type parsers
│   ├── migrations.ts      # SQL migrations, applied once and tracked
│   ├── migrate.ts         # `npm run migrate`
│   └── seed.ts            # `npm run seed` — demo data
├── lib/                   # Pure helpers: money, dates, phone, otp, jwt, logging
├── middleware/            # requireAuth, validate (Zod), error handler
└── modules/
    ├── auth/              # OTP request + verification, user creation
    ├── loans/             # CRUD + repay
    ├── summary/           # Aggregate reporting
    └── uploads/           # Receipt image upload
```

Each module is split into a **route** file (HTTP concerns) and a **service**
file (business logic and SQL), so the service layer can be tested and reused
without going through Express.

---

## Getting started

### 1. Prerequisites

- Node.js 20 or newer
- PostgreSQL 16 (or Docker)
- Expo Go matching this project's SDK 57, or an iOS Simulator / Android emulator
- For iOS Simulator: Xcode with an iOS Simulator runtime installed

### 2. Start PostgreSQL

<details>
<summary>Homebrew (macOS)</summary>

```bash
brew install postgresql@16
brew services start postgresql@16
```

</details>

<details>
<summary>Docker</summary>

```bash
docker run --name miniledger-postgres \
  -e POSTGRES_USER=miniledger \
  -e POSTGRES_PASSWORD=miniledger \
  -e POSTGRES_DB=miniledger \
  -p 5432:5432 -d postgres:16
```

</details>

For Homebrew PostgreSQL, create the role and databases:

```bash
psql -d postgres -c "CREATE ROLE miniledger LOGIN PASSWORD 'miniledger' CREATEDB;"
createdb -O miniledger miniledger
createdb -O miniledger miniledger_test
```

The Docker command above already creates `miniledger` and its owner. To add
the separate test database, run:

```bash
docker exec miniledger-postgres createdb -U miniledger miniledger_test
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit DATABASE_URL / JWT_SECRET if needed
npm run migrate           # creates the schema
npm run seed              # optional: a few demo loans
npm run dev               # http://localhost:3000
```

### 4. Mobile app

```bash
cd mobile
npm install
npm start                 # then press i / a, or scan the QR code with Expo Go
```

---

## The mock OTP

There is no SMS provider wired up. When you request an OTP, the server
**prints it to its own log**:

```
2026-10-22T08:05:09.292Z INFO [mock-otp] phone=******3210 otp=845577 expiresIn=300s
```

Everything else about the flow is real:

- the code is a cryptographically random 6-digit number
- it is stored **hashed** (scrypt + per-code salt), never in plaintext
- it is single-use — verifying consumes it
- it expires after 5 minutes
- requesting a new code invalidates the previous one
- 5 wrong attempts lock the code out

Swapping in a real SMS provider means replacing the `logger.info` line in
`backend/src/modules/auth/auth.service.ts` with a call to the provider.

---

## Running the app

1. Start the backend (`npm run dev` in `backend/`).
2. Start the app (`npm start` in `mobile/`). Android phones need the SDK 57
   Expo Go build linked from the version-mismatch screen if the Play Store
   Expo Go has already moved to SDK 58.
3. Enter any phone number, e.g. `9876543210`, and tap **Send OTP**.
4. Copy the 6-digit code from the API console and enter it.

### iOS Simulator setup

Install an iOS Simulator runtime in **Xcode → Settings → Components**. If Expo
cannot find Xcode, select its developer tools once from Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Then run `npm start` from `mobile/` and press `i`. Xcode 27 opens simulated
devices in **Device Hub**. If Expo Go reports an SDK mismatch, install the
SDK 57 build for the target simulator from [expo.dev/go](https://expo.dev/go?sdkVersion=57&platform=ios&device=false).

For Android, install the SDK 57 Expo Go build if the Play Store version is on a
different SDK: [Android device](https://expo.dev/go?sdkVersion=57&platform=android&device=true)
or [Android emulator](https://expo.dev/go?sdkVersion=57&platform=android&device=false).

### Pointing the app at the API

The API base URL is resolved in `mobile/src/config.ts`, in this order:

1. `EXPO_PUBLIC_API_URL` environment variable
2. A platform default — `http://localhost:3000` on iOS/web,
   `http://10.0.2.2:3000` on the Android emulator

On a **physical device** the API must be reachable over your network, so point
it at your machine's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 npm start
```

### Loading the receipt photo

The upload endpoint accepts `multipart/form-data` with a `receipt` field, up
to 5 MB, restricted to JPEG / PNG / WEBP / HEIC. File signatures are checked,
and receipts are served through an authenticated, owner-checked route.

---

## Testing

```bash
cd backend
npm test                 # 87 tests
npm run test:coverage
npm run typecheck
```

The suite runs against the real `miniledger_test` database — every test file
truncates the tables between cases, so there are no cross-test dependencies.

See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the full plan, the coverage
matrix and the cases that are still manual.

---

## Design decisions

**Money is stored in integer paise.** Floating point loses money
(`0.1 + 0.2 !== 0.3`). Amounts go in as `1500.50`, are stored as `150050`
paise, and come back out as both a number and a paise integer.

**Due dates are calendar days, not timestamps.** A loan is due on a date, not
at an instant, so `DATE` columns are read back as raw `YYYY-MM-DD` strings.
Postgres' default driver behaviour parses a `DATE` into a JS `Date` at *local*
midnight, which silently shifts the day for anyone east or west of UTC — the
driver is reconfigured in `backend/src/db/pool.ts` to avoid that.

**Overdue means "past due and still unpaid".** A repaid loan is never
overridden, no matter how old its due date was. A loan due *today* is not
overdue.

**Validation lives on the server, and is mirrored on the client.** Zod
schemas are the source of truth; the React Native form applies the same rules
so users get instant feedback instead of a round-trip that ends in a 400.

**Async route handlers cannot hang the server.** Express 4 only catches
synchronous throws, so a rejected promise would leave a request hanging
forever. `backend/src/lib/promiseErrors.ts` patches the request pipeline so
every rejection reaches the error handler.

**JWTs are stateless.** There is no refresh-token flow: a 30-day token is
stored in the device's secure keystore (`expo-secure-store`) and a failed
`GET /api/auth/me` on launch signs the user out.

---

## Project layout

```
MiniLedger/
├── backend/
│   ├── src/
│   ├── tests/                 # Jest + Supertest suites
│   ├── .env.example
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── api/               # typed API client + response types
│   │   ├── auth/              # AuthContext (SecureStore-backed session)
│   │   ├── components/        # Button, TextField, SummaryCard, EntryItem, ...
│   │   ├── screens/           # Login, Home, AddEntry
│   │   ├── utils/             # formatting + validation
│   │   └── theme.ts           # design tokens
│   ├── App.tsx
│   └── app.json
├── docs/
│   ├── API.md                 # endpoint reference
│   └── TEST_PLAN.md           # test plan and coverage matrix
└── scripts/
    └── dev.sh                 # starts the API and the app together
```
