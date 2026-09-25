# FIX-08 — Canonical transaction strategy (SQLite)

## Supported implementation

The checked-in Prisma 5 schema and migrations support SQLite. PostgreSQL 16 in the original architecture is a target design, not evidence of a production deployment. Verification uses isolated SQLite files, not production or PostgreSQL.

`runMutation` is the boundary for Trip, Expense and Itinerary mutations. Its first statement on the interactive transaction's own connection is:

```sql
UPDATE mutation_lock SET id = id WHERE id = 1;
```

The seeded singleton must exist. The UPDATE reserves SQLite's database writer **before any business read** and holds it through commit/rollback. It is not a row lock or `SELECT FOR UPDATE`. SQLite already permits only one writer: this deliberately trades write throughput for an explicit read/check/write boundary, coordinating independent clients/processes on the same DB file rather than a JavaScript mutex.

All affected writers must use this boundary. Direct administrative SQL or future code bypassing it is outside the service protocol. Changing provider requires a separate reviewed strategy and integration tests.

## Atomic unit

1. Start transaction and acquire writer.
2. For supported keyed operations, find the request receipt. Replay only the same scope/key/payload.
3. Read current records, verify permissions, CLOSED protection and allowed states.
4. Perform all dependent writes, including totals/policy/approval records.
5. Insert business audit and durable notification rows using the same `tx`. Failure rolls back the mutation.
6. Persist any receipt in that transaction, then commit.
7. Emit SSE after commit. Delivery failure is logged and never changes the successful HTTP result or retries the committed mutation. Notification list API provides recovery. SSE is best effort, not exactly-once durable delivery.

Pass `Prisma.TransactionClient` explicitly to helpers. Do not call global-client DB helpers or external network services in callbacks. `logAudit(input, tx)` is strict/atomic; existing no-tx auth use remains best effort. `createNotification(input, tx, afterCommit)` persists inside tx and schedules only SSE after commit. There are no nested transactions.

## Flow boundaries

| Flow | Atomic read/check/write unit |
|---|---|
| Create trip | Allocate yearly sequence, create trip, audit, optional receipt |
| Update/delete/start/end trip | Check owner/state, mutate; existing transition audit |
| Submit trip | Read DRAFT, compute policy, persist snapshot/state/audit/notification |
| Approve/reject trip | Check state/approver, approval record, trip state/audit/notification |
| Close trip | Check trip/expense, conditional update from EXPENSE_APPROVED, close expense, audit/notification |
| Create expense | Check owner/state/absence, create header, transition ONGOING trip to EXPENSE_DRAFT |
| Expense item CRUD | Check owner/CLOSED/expense state, mutate item, SUM items and update totalActual |
| Justification | Check owner/CLOSED/DRAFT, update justification |
| Submit expense | Read items/header/justification, validate existing variance rule, update expense/trip/audit/notifications |
| Approve/reject expense | Check current state/reapproval, update expense/trip/audit/notification |
| Manager reapprove | Check manager/current records, update trip/expense with existing action semantics, audit, optional receipt |
| Itinerary CRUD / AI Apply | Check owner/CLOSED/date range, mutate items; AI batch audit/receipt in same tx |

`immutableGuard` is an early HTTP check; service checks inside the reserved-writer transaction are authoritative. Wrong role/owner remains 403. Stale valid-actor transitions return 409 `INVALID_STATUS_TRANSITION`; CLOSED returns 409 `TRIP_IMMUTABLE`. If concurrent deletion wins, an absent resource returns 404. Independent edits serialize rather than being rejected merely for overlapping. This does not add optimistic version checks for stale client forms.

## Conflicts and retry

At most three attempts, retrying only recognized start/lock/contention errors: `P1008`, `P2034`, transaction-start `P2028`, raw SQLite busy/locked codes 5/6/517. Retry the whole callback with fresh reads and an empty after-commit queue. Do not retry business errors, arbitrary query failures or SSE delivery after commit.

Exhaustion returns 409 `CONCURRENT_MODIFICATION`. Other unexpected DB failures remain 500 and roll back; they are not disguised as CLOSED. Per-attempt Prisma maxWait is 2000ms, timeout 5000ms. Busy wait also depends on connector settings; no sub-second latency guarantee under contention.

## Constraints and identity

- Existing UNIQUE `expenses.trip_id` remains the 1:1 backstop. Serialized absence checks yield one create success and one business conflict.
- Existing UNIQUE `trips.trip_code` remains. `trip_code_sequences(year,value)` allocates codes transactionally, seeds from existing codes on first use and survives deletion. No count+1 allocation.
- `mutation_lock` contains the seeded row id 1.
- `mutation_receipts` has composite PK `(scope, request_key)` and stores fingerprint/committed JSON result. Receipts are not cascaded away on trip deletion.
- **No partial UNIQUE approval index** exists in SQLite migrations. Approval protection is writer reservation plus fresh state/permission checks in the same transaction.

Optional `Idempotency-Key` (1–128 characters, `[A-Za-z0-9._:-]`) is supported by POST create trip, POST expense item, POST Manager reapprove and POST itinerary (single/batch). Scope includes actor, operation and resource. Same key/payload replays original response data without new writes/audit/notification. Changed payload returns 409 `IDEMPOTENCY_CONFLICT`. A key identifies an intent, not item content. Without a key, additive requests are independent; different keys allow intentional identical items.

Frontend service functions accept a key, defaulting to a new UUID per invocation; token-refresh retries retain it. EmpCreate retains the AI Apply key across failures and resets it for a newly generated response. Other manual retries after ambiguous network failure must explicitly reuse the original key. Receipts have no automatic expiry: storage/privacy retention must be planned before production. Existing HTTP auth/immutable guards still precede replay.

## Migration and evidence

Apply `20260925110000_canonical_mutations` before starting the changed server:

```sh
npm --prefix src/backend run db:migrate:prod
npm --prefix src/backend run db:generate
```

It adds lock/receipt/sequence tables and seeds the lock; no provider change or application-data rewrite. Tests apply all migrations to temporary DB files. The user's application database is not migrated by this fix.

`src/backend/src/__tests__/concurrency.test.ts` uses two independent real Prisma clients and HTTP routes/controllers/services on one SQLite file. Coverage includes concurrent L1/L2/expense/close/start/end decisions, draft edit/delete versus submit, item mutations and totals versus submit, create collisions, close versus mutation, deterministic lock contention/exhaustion, fault-trigger rollback, audit/notification/SSE failure, keyed replay/new intent. Retry/effect-discard is tested with an injected conflict inside a real transaction. `itinerary.apply.test.ts` retains FIX-06 assertions.

These are correctness checks, not production load tests. Existing policy/variance contract test failures outside FIX-08 are reported separately; the concurrency suite does not imply a fully green repository.
