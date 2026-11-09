# School Admission System

ASP.NET Core 10 and PostgreSQL 18 backend for school admission. The eight backend endpoints and background hold expiry are implemented. The React frontend is the next milestone.

## Run the backend

Install and start Docker Desktop with Linux containers, then run from the repository root:

```sh
docker compose up --build
```

API: http://localhost:8080. Health check: http://localhost:8080/health.
Database migrations run automatically at startup. PostgreSQL data is stored in a named volume and survives `docker compose down` followed by `docker compose up`. Do not use `down -v` if you want to retain that data.

Optional environment settings:

- `HOLD_DURATION_SECONDS`: positive integer, default `600`.
- `ADMISSION_DB_CONNECTION`: overrides the backend PostgreSQL connection string. Its host must be reachable from the backend container. The application's direct configuration key is `ConnectionStrings__AdmissionDb`.

## Run automated backend tests

Only Docker is required; the test runner includes the .NET SDK.

```sh
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

The command returns a nonzero exit code if a test fails. After reviewing the results, remove the test containers:

```sh
docker compose -f docker-compose.test.yml down
```

The test stack has its own Compose project, network, backend and temporary PostgreSQL database. It publishes no host ports and does not use the development database or its volume. Tests send actual HTTP requests through the running API; PostgreSQL queries verify stored data and clean up only records created by the tests.

Coverage includes class validation and responses, student identity and ownership, concurrent seat allocation (60 requests for 7 seats), duplicate student races, idempotent confirmation/cancellation, confirm/cancel races, and autonomous background expiry. The expiry test shortens test-record deadlines in PostgreSQL and polls the database without API calls, so a read endpoint cannot accidentally satisfy that test.

Regression tests also cover expiry beyond 100 locked classes and consistent expired-hold reads before the worker persists the status. Expiry decisions and seat counts use PostgreSQL time. The worker selects and locks up to 100 available classes in one transaction, skipping busy classes while filling the batch.

## Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/classes` | Create a class with `name` and `totalSeats` |
| GET | `/classes` | List classes and seat counts |
| GET | `/classes/{classId}` | Class details and seat counts |
| POST | `/classes/{classId}/holds` | Hold a seat |
| GET | `/holds/{holdId}` | Hold status and expiry |
| POST | `/holds/{holdId}/confirm` | Confirm admission |
| DELETE | `/holds/{holdId}` | Cancel an active hold |
| GET | `/me/holds` | Student's application history |

Hold creation, confirmation, cancellation and My Applications require `X-Student-Id`: exactly 17 ASCII digits, including any leading zeros. Confirmation simulates payment; there is no login or real payment gateway.
