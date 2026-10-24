/**
 * Schema migrations.
 *
 * Migrations are plain SQL kept in TypeScript so that a compiled build never
 * needs to copy `.sql` files around. Each entry is applied exactly once and
 * recorded in `schema_migrations`.
 */

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone       VARCHAR(20) NOT NULL UNIQUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS otp_codes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone       VARCHAR(20) NOT NULL,
        code_hash   TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        attempts    INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_otp_codes_phone
        ON otp_codes (phone, created_at DESC);

      CREATE TABLE IF NOT EXISTS loans (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        friend_name  VARCHAR(120) NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        due_date     DATE NOT NULL,
        note         VARCHAR(500),
        status       VARCHAR(16) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'repaid')),
        repaid_at    TIMESTAMPTZ,
        receipt_path VARCHAR(500),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans (user_id, status);
      CREATE INDEX IF NOT EXISTS idx_loans_user_due    ON loans (user_id, due_date);

      -- Partial index used by the "overdue" summary + list filter.
      CREATE INDEX IF NOT EXISTS idx_loans_overdue
        ON loans (user_id, due_date)
        WHERE status = 'pending';
    `,
  },
  {
    id: '002_amount_limit',
    sql: `
      ALTER TABLE loans
        ADD CONSTRAINT loans_amount_max
        CHECK (amount_cents <= 9999999999);
    `,
  },
  {
    id: '003_private_receipts',
    sql: `
      CREATE TABLE receipt_uploads (
        filename   VARCHAR(80) PRIMARY KEY,
        user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_receipt_uploads_owner ON receipt_uploads (user_id, created_at DESC);

      -- Preserve access to receipts created before receipt URLs became private.
      INSERT INTO receipt_uploads (filename, user_id)
      SELECT DISTINCT regexp_replace(receipt_path, '^/uploads/', ''), user_id
        FROM loans
       WHERE receipt_path ~ '^/uploads/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$'
      ON CONFLICT (filename) DO NOTHING;

      UPDATE loans
         SET receipt_path = '/api/uploads/receipt/' || regexp_replace(receipt_path, '^/uploads/', '')
       WHERE receipt_path ~ '^/uploads/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$';
    `,
  },
];
