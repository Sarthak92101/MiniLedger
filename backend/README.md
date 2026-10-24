# MiniLedger backend

The REST API. See the [root README](../README.md) for the full setup guide and
[`docs/API.md`](../docs/API.md) for the endpoint reference.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run migrate` | Apply pending database migrations |
| `npm run seed` | Insert demo loans for phone `9876543210` |
| `npm test` | Run the Jest + Supertest suite |
| `npm run test:coverage` | Run the suite with a coverage report |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

Copy `.env.example` to `.env` for local development. Development has explicit
fallback values, but production configuration is rejected because this build
prints mock OTPs instead of sending SMS. Configure a real SMS provider before
deploying.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | |
| `DATABASE_URL` | local development URL | Set your local PostgreSQL connection |
| `JWT_SECRET` | development-only secret | Use a random secret of at least 32 characters outside development |
| `JWT_EXPIRES_IN` | `30d` | |
| `OTP_LENGTH` | `6` | |
| `OTP_TTL_SECONDS` | `300` | |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses before the code is burned |
| `DEFAULT_COUNTRY_CODE` | `91` | Used when normalising phone numbers |
| `MAX_UPLOAD_BYTES` | `5242880` | 5 MB |
| `UPLOAD_DIR` | `backend/uploads` | Where receipts are stored |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |

## Layout

```
src/
├── app.ts                 # Express app factory
├── index.ts               # Bootstrap: migrate → listen → graceful shutdown
├── config/index.ts        # Environment configuration
├── db/
│   ├── pool.ts            # pg Pool + DATE/NUMERIC type parsers
│   ├── migrations.ts      # SQL migrations
│   ├── migrate.ts
│   └── seed.ts
├── lib/                   # money, dates, phone, otp, jwt, logger, errors
├── middleware/            # requireAuth, validate, errorHandler
└── modules/
    ├── auth/
    ├── loans/
    ├── summary/
    └── uploads/
```

## The mock OTP

`POST /api/auth/otp/request` prints the code to the server log:

```
INFO [mock-otp] phone=******3210 otp=845577 expiresIn=300s
```

The code is random, hashed at rest, single-use, time-limited, and invalidated
when a new one is requested. Production startup is blocked until a real SMS
provider replaces this development-only flow.

## Tests

The suite talks to a real PostgreSQL database (`miniledger_test` by default,
override with `TEST_DATABASE_URL`). Point it at a scratch database — the
tables are truncated between every test.

```bash
createdb miniledger_test
npm test
```
