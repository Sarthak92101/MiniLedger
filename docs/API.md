# MiniLedger API reference

Base URL: `http://localhost:3000`

All requests and responses are JSON (`application/json`), except the receipt
upload which uses `multipart/form-data`.

## Error shape

Every non-2xx response uses the same envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "friendName is required",
    "details": { "source": "body", "issues": [{ "path": "friendName", "message": "..." }] }
  }
}
```

`details` is only present for validation failures.

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | The request body or query failed validation |
| `INVALID_OTP` | 400 | The OTP is wrong or no OTP is active |
| `OTP_EXPIRED` | 400 | The OTP is older than `OTP_TTL_SECONDS` |
| `UNAUTHORIZED` | 401 | Missing, malformed or expired bearer token |
| `FORBIDDEN` | 403 | Authenticated, but not allowed |
| `NOT_FOUND` | 404 | No such resource (or it belongs to another user) |
| `CONFLICT` | 409 | Conflicting state |
| `RATE_LIMITED` | 429 | Too many OTP attempts |
| `PAYLOAD_TOO_LARGE` | 413 | The upload exceeds `MAX_UPLOAD_BYTES` |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The upload is not an accepted image type |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication

### `POST /api/auth/otp/request`

Issues a one-time code for a phone number. **The code is printed to the server
log** — there is no SMS provider.

**Request**

```json
{ "phone": "9876543210" }
```

`phone` is normalised before it is stored: spaces, dashes and parentheses are
removed, a leading `00` becomes nothing, and an explicit `+` country code is
preserved.

**Response `200`**

```json
{
  "message": "OTP sent. Check the server logs for the mock code.",
  "phone": "9876543210",
  "expiresInSeconds": 300
}
```

In `NODE_ENV=test` the response also contains `debugCode` so the test suite
can complete the flow. It is never returned in development or production.

**Server log**

```
INFO [mock-otp] phone=******3210 otp=845577 expiresIn=300s
```

### `POST /api/auth/otp/verify`

Verifies the code and returns a JWT.

**Request**

```json
{ "phone": "9876543210", "otp": "845577" }
```

**Response `200`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "0f3c…",
    "phone": "9876543210",
    "createdAt": "2026-10-22T08:05:09.101Z"
  }
}
```

The user row is created on the first successful login, and reused afterwards.

Rules: the code must match the most recent active code for that number, must
not be expired, and must not have exceeded `OTP_MAX_ATTEMPTS` wrong guesses.
A successful verification consumes the code.

**Errors** — `INVALID_OTP` (400), `OTP_EXPIRED` (400), `RATE_LIMITED` (429).

### `GET /api/auth/me`

Returns the authenticated user. Requires `Authorization: Bearer <token>`.

**Response `200`**

```json
{ "user": { "id": "0f3c…", "phone": "9876543210", "createdAt": "…" } }
```

---

## Loans

All loan endpoints require `Authorization: Bearer <token>`. A loan is only
ever visible to the user who created it.

### The loan object

```json
{
  "id": "20fb80a0-33c8-4e32-b05f-db0a1f43b691",
  "friendName": "Amit",
  "amount": 1500,
  "amountCents": 150000,
  "dueDate": "2026-10-10",
  "note": "Lunch money I covered",
  "status": "pending",
  "isOverdue": true,
  "daysUntilDue": -12,
  "daysOverdue": 12,
  "repaidAt": null,
  "receiptUrl": "/api/uploads/receipt/6f1c….jpg",
  "createdAt": "2026-10-22T08:04:57.448Z",
  "updatedAt": "2026-10-22T08:04:57.448Z"
}
```

| Field | Notes |
| --- | --- |
| `amount` | Decimal number, e.g. `1500.5` |
| `amountCents` | Exact integer amount in paise |
| `status` | `pending` or `repaid` |
| `isOverdue` | `status === 'pending'` **and** `dueDate < today` |
| `daysUntilDue` | Negative when the due date has passed, `0` when due today |
| `daysOverdue` | Days late, `0` when not overdue |
| `repaidAt` | ISO timestamp, `null` while pending |

### `POST /api/loans`

**Request**

```json
{
  "friendName": "Amit",
  "amount": 1500.50,
  "dueDate": "2026-11-15",
  "note": "Birthday gift",
  "receiptUrl": "/api/uploads/receipt/6f1c….jpg"
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `friendName` | yes | 1–120 characters, trimmed |
| `amount` | yes | Number or numeric string, > 0, max 2 decimal places, ≤ 99,999,999.99 |
| `dueDate` | yes | `YYYY-MM-DD`, a real calendar date |
| `note` | no | ≤ 500 characters |
| `receiptUrl` | no | URL returned by the upload endpoint |

**Response `201`** — `{ "loan": { … } }`

### `GET /api/loans`

Lists the authenticated user's loans.

**Query parameters**

| Parameter | Values | Default |
| --- | --- | --- |
| `status` | `all`, `pending`, `repaid`, `overdue` | `all` |
| `search` | Free text, matched against the friend name | — |
| `limit` | 1–200 | `100` |
| `offset` | ≥ 0 | `0` |

**Response `200`**

```json
{ "loans": [ { "id": "…", "friendName": "Amit" } ], "count": 1 }
```

Overdue entries are sorted first, then by due date ascending.

### `GET /api/loans/:id`

**Response `200`** — `{ "loan": { … } }`
**Errors** — `NOT_FOUND` (404) if it does not exist or belongs to another user.

### `PATCH /api/loans/:id/repay`

Marks the loan as repaid. Idempotent — the original `repaidAt` is preserved.

**Request** (body optional)

```json
{ "repaidAt": "2026-10-22T08:05:09.101Z" }
```

**Response `200`** — `{ "loan": { … } }`

A repaid loan is never counted as overdue.

### `PATCH /api/loans/:id/unrepay`

Re-opens a repaid loan (`status` back to `pending`, `repaidAt` back to `null`).

**Response `200`** — `{ "loan": { … } }`

### `DELETE /api/loans/:id`

**Response `204`** — no content.

---

## Summary

### `GET /api/summary`

Returns the aggregate position of the authenticated user.

**Response `200`**

```json
{
  "summary": {
    "totalLent": 5250,
    "totalRepaid": 1500,
    "totalOutstanding": 3750,
    "overdueAmount": 2000,
    "currency": "INR",
    "counts": { "total": 4, "pending": 3, "repaid": 1, "overdue": 2 },
    "byFriend": [
      {
        "friendName": "Amit",
        "totalLent": 1500,
        "totalRepaid": 0,
        "outstanding": 1500,
        "overdueAmount": 1500,
        "entries": 2
      }
    ]
  }
}
```

| Field | Definition |
| --- | --- |
| `totalLent` | Sum of every loan ever created |
| `totalRepaid` | Sum of the loans with `status = 'repaid'` |
| `totalOutstanding` | `totalLent - totalRepaid` |
| `overdueAmount` | Sum of pending loans whose due date has passed |

`byFriend` is sorted by outstanding amount, descending.

---

## Uploads

### `GET /api/uploads/receipt/:filename`

Returns an uploaded receipt only to the authenticated user who uploaded it.
The mobile client sends its bearer token in the image request headers.

### `POST /api/uploads/receipt`

**Content type** — `multipart/form-data`, single field named `receipt`.

Accepted image types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
Maximum size: `MAX_UPLOAD_BYTES` (5 MB by default).

**Response `201`**

```json
{
  "receiptUrl": "/api/uploads/receipt/6f1c9d0e-….jpg",
  "filename": "6f1c9d0e-….jpg",
  "size": 24576,
  "mimeType": "image/jpeg"
}
```

The upload route checks both the declared MIME type and the image file header.
Pass `receiptUrl` back as `receiptUrl` when creating a loan. Retrieve the file
from that URL with the same bearer token; receipts are private to the uploading
user.

**Errors** — `UNSUPPORTED_MEDIA_TYPE` (415), `PAYLOAD_TOO_LARGE` (413),
`VALIDATION_ERROR` (400) when no file was sent.

---

## Health

### `GET /health`

```json
{ "status": "ok", "service": "miniledger", "env": "development" }
```

Unauthenticated. Useful for container health checks.
