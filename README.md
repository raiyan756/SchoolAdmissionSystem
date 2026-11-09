# School Admission System

An English admission portal with React/TypeScript, ASP.NET Core 10 and PostgreSQL 18. School staff create classes; students hold seats, confirm simulated fee payment, cancel active applications and review history. Allocation and expiry coordinate through database row locks, including across multiple backend processes.

## Start with Docker

Start Docker Desktop with Linux containers. From the repository root:

```sh
docker compose up
```

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8080
- **Health:** http://localhost:8080/health

Only Docker is required. Compose builds missing images, starts PostgreSQL, applies versioned migrations and serves the frontend. The first build downloads images/packages; wait for startup to finish. After changing source code, run `docker compose up --build`. Add `-d` to run in the background.

Open **Create class**, enter a class/shift name and seat count. On **Classes**, select a class. Set a fictional 17-digit student ID (e.g. `00123456789012345`) at the top, apply and choose **Pay admission fee** to confirm. Payment is simulated: no money is collected. Use **My applications** to revisit status/history. Each shift is a separately named class.

Stop with `docker compose down`. The named PostgreSQL volume retains data. `down -v` deletes that volume, so do not use it for an ordinary restart. There is no seeded data; creating a class in the UI is the first step.

## Configuration

Set variables in a local root `.env` file (ignored by Git) or your shell before running Compose:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOLD_DURATION_SECONDS` | `600` | Positive hold duration in seconds |
| `ADMISSION_DB_CONNECTION` | Local Compose PostgreSQL connection | Backend database connection; host must be reachable from the API container |
| `API_BASE_URL` | `http://backend:8080` | Frontend web server's upstream API origin; absolute HTTP(S) origin without a trailing slash |

The backend's direct connection setting is `ConnectionStrings__AdmissionDb`. Compose credentials are development-only. Recreate containers after changing settings: `docker compose up -d --force-recreate`. Frontend API configuration is applied at container startup, so changing `API_BASE_URL` does not require rebuilding JavaScript.

The browser calls same-origin `/api/...`; Nginx forwards those requests to `API_BASE_URL`, stripping `/api`. `backend` is a Docker service name, not a browser hostname. For an API on the host machine from Docker Desktop, an example target is `http://host.docker.internal:8080`. An alternative upstream must implement the same API contract.

## Backend automated tests

```sh
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

This runs **25 xUnit cases** against real PostgreSQL and two API processes (container ports 8080 and 8081). Coverage includes:

- Contract/validation, missing records, ownership and history isolation.
- 60 simultaneous allocations for seven seats, duplicate-student races and concurrent confirmation/cancellation.
- Autonomous expiry, effective expired reads and expiry past 100 locked candidates.
- Cross-process capacity with an already-confirmed admission, and duplicate-student protection across both APIs.

The stack has its own Compose project and temporary database, with no host ports or development-volume mounts. Fixtures are cleaned up. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for the concurrency strategy and limits.

## Frontend automated tests

```sh
docker compose -f docker-compose.frontend-test.yml up --build --abort-on-container-exit --exit-code-from tests
```

Chromium/Playwright runs entirely in Docker. The test image contains browsers, so its first download is larger than the application image. The isolated stack uses the production frontend image, a real API and temporary PostgreSQL database. A 12-second hold duration keeps expiry checks short.

Nine deterministic browser tests cover contracts/validation, leading-zero identity and switching, duplicate/pending requests, confirmation, cancellation with 204, server-authoritative expiry, retry/empty states, slow-request polling and mobile/keyboard behaviour. Five real-stack journeys cover confirmation/reload/history, cancellation, expiry, two browser sessions competing for the last seat, and restoring a current application in a new browser session using persisted local storage.

Both test commands return nonzero on failure. Check/preserve that result before cleanup:

```sh
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.frontend-test.yml down
```

To retrieve frontend failure screenshots/traces before removing the test container:

```sh
docker compose -f docker-compose.frontend-test.yml cp tests:/app/test-results ./frontend-test-results
```

## Optional local frontend development

With Node.js 24 and the Docker backend running:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080`; override `API_BASE_URL` in `frontend/.env.local` and restart Vite to use another backend. `npm run build` typechecks and builds static assets. For deterministic tests locally, run `npx playwright install chromium` then `npm test`; real-stack journeys are enabled by the Docker test configuration.

## Structure and API

`backend/` contains one API project with Controllers, Services, Repositories, Models, DTOs, Data/Migrations and Workers. `frontend/` contains React pages, shared UI, API types/client and small request hooks. `tests/SchoolAdmission.Api.Tests/` holds backend tests. Frontend tests live in `frontend/tests/`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/classes` | Create with `name` and `totalSeats` |
| GET | `/classes` | Class list and seat counts |
| GET | `/classes/{classId}` | Class details and seat counts |
| POST | `/classes/{classId}/holds` | Hold a seat |
| GET | `/holds/{holdId}` | Status and expiry |
| POST | `/holds/{holdId}/confirm` | Confirm admission |
| DELETE | `/holds/{holdId}` | Cancel an active hold |
| GET | `/me/holds` | Student's application history |

Creation of holds, confirmation, cancellation and My Applications require `X-Student-Id`: exactly 17 ASCII digits, including leading zeros. There is no login or real payment gateway. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for lifecycle/security assumptions and [AI_USAGE.md](AI_USAGE.md) for AI assistance and review corrections.
