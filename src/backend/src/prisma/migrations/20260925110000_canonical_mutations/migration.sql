-- SQLite writer reservation. Every business mutation updates this row first.
CREATE TABLE "mutation_lock" ("id" INTEGER NOT NULL PRIMARY KEY);
INSERT INTO "mutation_lock" ("id") VALUES (1);

-- Explicit request identity, never content-based deduplication.
CREATE TABLE "mutation_receipts" (
  "scope" TEXT NOT NULL,
  "request_key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  PRIMARY KEY ("scope", "request_key")
);

-- Transactional, monotonically increasing trip-code allocation per year.
CREATE TABLE "trip_code_sequences" (
  "year" INTEGER NOT NULL PRIMARY KEY,
  "value" INTEGER NOT NULL
);
