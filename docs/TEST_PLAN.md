# MiniLedger — test plan

Scope: the backend API is covered by automated tests. The mobile app is
covered by the manual checklist in section 6.

---

## 1. Strategy

| Level | Tool | What it covers |
| --- | --- | --- |
| Unit | Jest | Pure helpers: money, dates, phone normalisation, OTP hashing |
| Integration | Jest + Supertest | Every HTTP endpoint against a real PostgreSQL database |
| Manual | — | Mobile UI flows, native camera / gallery, device builds |

The integration tests run against a **real** `miniledger_test` database rather
than a mock or an in-memory emulator, so SQL correctness (aggregation,
`FILTER` clauses, `DATE` comparison, timezone handling) is genuinely verified.
`TRUNCATE ... RESTART IDENTITY CASCADE` runs in `beforeEach`, so every test
starts from a known-empty state and cases can run in any order.

```
backend/tests/
├── env.ts          # sets DATABASE_URL etc. before any module is imported
├── setup.ts        # runs migrations once, truncates between tests
├── helpers.ts      # api(), createTestUser(), auth(), relativeDate()
├── units.test.ts   # 21 unit tests
├── auth.test.ts    # 19 auth + health tests
├── loans.test.ts   # 32 loan tests
├── summary.test.ts # 8 summary tests
└── uploads.test.ts # 7 upload tests
```
**Running**

```bash
cd backend
npm test                 # 87 tests
npm run test:coverage
npm run test:watch
```

**Coverage** — `npm run test:coverage` reports on `src/**` (excluding
`index.ts` and `seed.ts`). The remaining gaps are the bootstrap and the
process-level signal handlers.

---

## 2. Authentication

| # | Case | Expected | Type |
| --- | --- | --- | --- |
| A1 | Request an OTP for a valid number | 200, code returned (test mode) | Auto |
| A2 | Request an OTP with spaces / dashes / parens | Number normalised | Auto |
| A3 | Request an OTP with `+` country code | Country code preserved | Auto |
| A4 | Request an OTP with no phone | 400 `VALIDATION_ERROR` | Auto |
| A5 | Request an OTP with a 3-digit number | 400 `VALIDATION_ERROR` | Auto |
| A6 | Request an OTP with letters | 400 `VALIDATION_ERROR` | Auto |
| A7 | Request a second OTP | First code stops working | Auto |
| A8 | Verify with the correct code | 200 + token + user | Auto |
| A9 | Verify with a wrong code | 400 `INVALID_OTP` | Auto |
| A10 | Verify the same code twice | Second attempt rejected | Auto |
| A11 | Verify without ever requesting a code | 400 `INVALID_OTP` | Auto |
| A12 | Verify with a non-numeric code | 400 `VALIDATION_ERROR` | Auto |
| A13 | First successful login | User is created | Auto |
| A14 | Second login on the same number | Same user id reused | Auto |
| A15 | `GET /me` with no token | 401 | Auto |
| A16 | `GET /me` with a garbage token | 401 | Auto |
| A17 | `GET /me` with a token signed by another secret | 401 | Auto |
| A18 | OTP is not stored in plaintext | Column holds `salt:hash` | Manual |
| A19 | OTP expires after `OTP_TTL_SECONDS` | 400 `OTP_EXPIRED` | Manual |
| A20 | 6 wrong guesses lock the code out | 429 `RATE_LIMITED` | Manual |
| A21 | `GET /health` | 200 `status: ok` | Auto |
| A22 | Unknown route | 404 with the standard error envelope | Auto |

---

## 3. Loans

| # | Case | Expected | Type |
| --- | --- | --- | --- |
| L1 | Create a loan | 201, correct amount in paise, `pending` | Auto |
| L2 | Create with the amount as a string | Parsed to paise | Auto |
| L3 | Missing friend name | 400 | Auto |
| L4 | Zero amount | 400 | Auto |
| L5 | Negative amount | 400 | Auto |
| L6 | Amount with 3 decimal places | 400 | Auto |
| L7 | Missing due date | 400 | Auto |
| L8 | Malformed due date (`15-01-2026`) | 400 | Auto |
| L9 | Impossible date (`2026-02-31`) | 400 | Auto |
| L10 | No token | 401 | Auto |
| L11 | Friend name is trimmed | `Amit`, not `"  Amit  "` | Auto |
| L12 | List returns only your own loans | Other user's loans excluded | Auto |
| L13 | List for a user with no loans | Empty array | Auto |
| L14 | Overdue loans sort first and are flagged | `isOverdue`, `daysOverdue` | Auto |
| L15 | A loan due today is not overdue | `isOverdue === false` | Auto |
| L16 | Filter `status=overdue` | Only overdue entries | Auto |
| L17 | Filter `status=repaid` | Only repaid entries | Auto |
| L18 | Search by friend name | Case-insensitive match | Auto |
| L19 | Invalid status filter | 400 | Auto |
| L20 | Get a loan by id | 200 | Auto |
| L21 | Get an unknown id | 404 | Auto |
| L22 | Get another user's loan | 404 (does not leak) | Auto |
| L23 | Malformed id | 400 | Auto |
| L24 | Mark as repaid | `status`, `repaidAt` set | Auto |
| L25 | Mark as repaid twice | Idempotent, original date kept | Auto |
| L26 | Repay another user's loan | 404 | Auto |
| L27 | Undo a repayment | Back to `pending` | Auto |
| L28 | Delete a loan | 204, gone from the list | Auto |
| L29 | Delete another user's loan | 404 | Auto |
| L30 | Very large amount (above the cap) | 400 | Auto |
| L31 | Note longer than 500 characters | 400 | Auto |
| L32 | Friend name longer than 120 characters | 400 | Auto |

---

## 4. Summary

| # | Case | Expected | Type |
| --- | --- | --- | --- |
| S1 | No loans | All amounts `0`, counts `0` | Auto |
| S2 | Mixed set of loans | Totals, outstanding and overdue all correct | Auto |
| S3 | Counts by status | `total`, `pending`, `repaid`, `overdue` | Auto |
| S4 | Per-friend breakdown | Lent / repaid / outstanding / overdue per friend | Auto |
| S5 | A repaid loan with a past due date | Not counted as overdue | Auto |
| S6 | Two users' data | Never mixed | Auto |
| S7 | Summary after repaying | Overdue drops, repaid rises, outstanding drops | Auto |
| S8 | No token | 401 | Auto |
| S9 | Summary matches the sum of the list | Cross-check | Manual |

---

## 5. Uploads

| # | Case | Expected | Type |
| --- | --- | --- | --- |
| U1 | Upload a PNG | 201, file stored, URL returned | Auto |
| U2 | Upload a non-image | 415 `UNSUPPORTED_MEDIA_TYPE` | Auto |
| U3 | Upload with no file | 400 | Auto |
| U4 | Upload without a token | 401 | Auto |
| U5 | Attach an uploaded receipt to a loan | `receiptUrl` saved | Auto |
| U6 | Upload larger than the cap | 413 | Manual |
| U7 | Filenames are randomised, never user-controlled | No path traversal | Manual |

---

## 6. Mobile app (manual)

| # | Case | Expected |
| --- | --- | --- |
| M1 | Enter a phone number and send the OTP | The OTP appears in the API log |
| M2 | Enter an invalid phone number | Inline validation, no request sent |
| M3 | Enter a wrong OTP | Inline error, still on the OTP step |
| M4 | Enter the correct OTP | Home screen loads |
| M5 | Kill and relaunch the app | Still signed in (token restored from the keystore) |
| M6 | Sign out | Back to the login screen |
| M7 | Empty ledger | Empty state with an "Add an entry" call to action |
| M8 | Add an entry | It appears in the list and the summary updates |
| M9 | Overdue entry | Red accent rail, red amount, "N days overdue" badge |
| M10 | Entry due today | Not highlighted |
| M11 | Repaid entry | Struck-through name, green "Repaid" badge |
| M12 | Mark as repaid | Status changes, totals update |
| M13 | Undo a repayment | Back to pending |
| M14 | Filter tabs | The list narrows correctly; the Overdue tab shows a count |
| M15 | Pull to refresh | List and summary refresh |
| M16 | Attach a receipt from the gallery | Thumbnail shown, image uploaded |
| M17 | Take a receipt photo | Same, using the camera |
| M18 | Camera permission denied | A clear explanation, no crash |
| M19 | Submit with an invalid amount | Inline validation, no request sent |
| M20 | Submit with an impossible date | Inline validation |
| M21 | Backend unreachable | A readable error message, not a blank screen |
| M22 | Rotate the device | The layout holds |
| M23 | Run on a physical device over the LAN | The configured `EXPO_PUBLIC_API_URL` is honoured |

---

## 7. Out of scope

These are deliberately not covered and are noted as follow-ups rather than
silently skipped:

- **Rate limiting on the login endpoints** — the OTP attempt counter exists
  but there is no per-IP or per-number throttle on `POST /otp/request`.
- **Token revocation** — a JWT stays valid until it expires; there is no
  deny-list.
- **Concurrent edits** — two devices editing the same loan is last-write-wins.
- **Currency conversion** — a single currency is assumed throughout.
- **Push notifications** for upcoming and overdue due dates.
- **Offline support** — the app requires a network connection.
- **Load testing** — the API is single-instance with a 10-connection pool.

---

## 8. Regression checklist

Run before every release:

1. `cd backend && npm run typecheck && npm test` — must be green.
2. `cd backend && npm run build` — must compile cleanly.
3. `cd mobile && npx tsc --noEmit` — must be clean.
4. `cd mobile && npx expo export --platform ios` — must bundle.
5. Manual pass over section 6, items M1, M4, M8, M9, M12, M16.
