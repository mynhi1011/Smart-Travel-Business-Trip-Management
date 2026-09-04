/*
  Migration: add_trip_code
  Thêm field trip_code (TR-YYYY-NNNN) vào bảng trips.
  SQLite không hỗ trợ ADD COLUMN NOT NULL nếu bảng đã có data,
  nên phải thêm nullable trước, backfill, rồi rebuild bảng để enforce NOT NULL.
*/

-- Bước 1: Thêm cột nullable tạm
ALTER TABLE "trips" ADD COLUMN "trip_code" TEXT;

-- Bước 2: Backfill trip_code cho mọi row theo thứ tự created_at
-- Format: TR-{YEAR}-{4-digit counter}
UPDATE "trips"
SET "trip_code" = (
  'TR-' ||
  CAST(STRFTIME('%Y', "created_at") AS TEXT) ||
  '-' ||
  PRINTF('%04d',
    (
      SELECT COUNT(*)
      FROM "trips" t2
      WHERE t2."created_at" < "trips"."created_at"
         OR (t2."created_at" = "trips"."created_at" AND t2."id" <= "trips"."id")
    )
  )
);

-- Bước 3: Rebuild bảng để enforce NOT NULL + thêm UNIQUE index
-- (SQLite không hỗ trợ ALTER COLUMN, phải dùng CREATE TABLE + copy + DROP + rename)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_trips" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "trip_code"           TEXT NOT NULL,
    "employee_id"         TEXT NOT NULL,
    "origin"              TEXT NOT NULL,
    "destination"         TEXT NOT NULL,
    "destination_type"    TEXT NOT NULL,
    "departure_date"      DATETIME NOT NULL,
    "return_date"         DATETIME NOT NULL,
    "purpose"             TEXT NOT NULL,
    "estimated_budget"    INTEGER NOT NULL,
    "hotel_cost_per_night" INTEGER,
    "hotel_nights"        INTEGER,
    "per_diem_budget"     INTEGER,
    "transport_budget"    INTEGER,
    "other_budget"        INTEGER,
    "status"              TEXT NOT NULL DEFAULT 'DRAFT',
    "is_urgent"           BOOLEAN NOT NULL DEFAULT false,
    "urgency_reason"      TEXT,
    "requires_level2"     BOOLEAN NOT NULL DEFAULT false,
    "submitted_at"        DATETIME,
    "approved_at"         DATETIME,
    "closed_at"           DATETIME,
    "created_at"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          DATETIME NOT NULL,
    CONSTRAINT "trips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_trips" (
  "id", "trip_code", "employee_id", "origin", "destination", "destination_type",
  "departure_date", "return_date", "purpose", "estimated_budget",
  "hotel_cost_per_night", "hotel_nights", "per_diem_budget", "transport_budget", "other_budget",
  "status", "is_urgent", "urgency_reason", "requires_level2",
  "submitted_at", "approved_at", "closed_at", "created_at", "updated_at"
)
SELECT
  "id", "trip_code", "employee_id", "origin", "destination", "destination_type",
  "departure_date", "return_date", "purpose", "estimated_budget",
  "hotel_cost_per_night", "hotel_nights", "per_diem_budget", "transport_budget", "other_budget",
  "status", "is_urgent", "urgency_reason", "requires_level2",
  "submitted_at", "approved_at", "closed_at", "created_at", "updated_at"
FROM "trips";

DROP TABLE "trips";
ALTER TABLE "new_trips" RENAME TO "trips";

CREATE UNIQUE INDEX "trips_trip_code_key"        ON "trips"("trip_code");
CREATE INDEX        "trips_employee_id_idx"       ON "trips"("employee_id");
CREATE INDEX        "trips_status_idx"            ON "trips"("status");
CREATE INDEX        "trips_departure_date_idx"    ON "trips"("departure_date");
CREATE INDEX        "trips_employee_id_status_idx" ON "trips"("employee_id", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
