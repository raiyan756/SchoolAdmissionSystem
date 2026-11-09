# School Admission System - Implementation Plan

This document summarizes the step-by-step implementation milestones and completed verification. The applicant made the final architecture, system design and frontend design decisions and provided the implementation direction. OpenAI Codex assisted with implementation, detailed planning and verification, as described in [AI_USAGE.md](../AI_USAGE.md).

Status: backend, frontend, Docker packaging and submission verification completed. Latest application verification: 25 backend tests and 14 frontend tests passed.

## Architecture

One ASP.NET Core API project uses a controller-service-repository structure:

```text
Controller -> Service -> Repository -> DbContext -> PostgreSQL
```

Services also use the shared scoped DbContext to manage transactions and SaveChanges. Repository methods do not commit independently. This keeps seat checks and updates in one transaction.

```text
SchoolAdmissionSystem/
|-- backend/
|   |-- Controllers/
|   |-- Services/
|   |-- Repositories/Interfaces/
|   |-- Models/
|   |-- DTOs/
|   |-- Data/Migrations/
|   |-- Workers/
|   |-- Properties/
|   |-- Program.cs
|   |-- appsettings.json
|   |-- SchoolAdmission.Api.csproj
|   `-- Dockerfile
|-- frontend/
|   |-- src/
|   |-- tests/
|   `-- Dockerfile
|-- tests/SchoolAdmission.Api.Tests/
|-- DOCS/IMPLEMENTATION_PLAN.md
|-- docker-compose.yml
|-- docker-compose.test.yml
|-- docker-compose.frontend-test.yml
|-- README.md
|-- ASSUMPTIONS.md
`-- AI_USAGE.md
```

## Implementation steps

### 1. Set up the backend structure

- [x] Create one ASP.NET Core API project with controller, service, repository, model, DTO, data and worker folders.
- [x] Configure startup, dependency injection and a health endpoint on port 8080.
- [x] Verify the build and HTTP health response.

### 2. Configure Docker and PostgreSQL

- [x] Add the backend Dockerfile and a root Compose file with backend and PostgreSQL services.
- [x] Read database configuration from environment settings.
- [x] Add a database health check and a named volume for persistent data.
- [x] Verify container startup and database availability.

### 3. Implement the database model

- [x] Add SchoolClass and Hold entities with HELD, CONFIRMED, EXPIRED and CANCELLED states.
- [x] Store the 17-digit student ID as text to preserve leading zeros.
- [x] Configure relationships, validation constraints and indexes in AppDbContext.
- [x] Add a partial unique index preventing multiple HELD/CONFIRMED records for one student and class.
- [x] Create the initial EF Core migration and apply migrations at application startup.
- [x] Verify schema creation and persistence across an ordinary Compose restart.

### 4. Build class management APIs

- [x] Implement POST /classes, GET /classes and GET /classes/{classId}.
- [x] Validate class names and positive seat counts; return the required response fields and status codes.
- [x] Calculate held, confirmed and available seats through database queries.
- [x] Use controllers for HTTP handling, services for operations and repositories for queries.
- [x] Verify successful requests, invalid input and missing records.

### 5. Implement seat allocation safely

- [x] Implement POST /classes/{classId}/holds with X-Student-Id validation.
- [x] Use a Read Committed transaction and PostgreSQL FOR UPDATE lock on the class row.
- [x] After acquiring the lock, read database time, expire stale holds, check duplicates and capacity, then insert and commit.
- [x] Read HOLD_DURATION_SECONDS from configuration, defaulting to 600 seconds.
- [x] Return conflicts for exhausted capacity or an existing active/confirmed admission in the same class.
- [x] Verify concurrent requests cannot allocate more seats than the class capacity.

### 6. Complete the hold lifecycle

- [x] Implement GET /holds/{holdId}, POST /holds/{holdId}/confirm, DELETE /holds/{holdId} and GET /me/holds.
- [x] Check ownership before confirmation or cancellation; preserve application history.
- [x] Make repeated owner confirmation and cancellation idempotent.
- [x] Keep confirmed admissions occupying seats after their original hold deadline.
- [x] Add a background worker that expires unpaid holds without incoming API requests.
- [x] Use the same class-locking protocol for allocation, confirmation, cancellation and expiry.

### 7. Add backend tests and review fixes

- [x] Run xUnit integration tests against an isolated real PostgreSQL database in Docker.
- [x] Cover API contracts, validation, ownership, history, duplicate requests, confirmation, cancellation and expiry.
- [x] Exercise allocation and lifecycle races with simultaneous HTTP requests.
- [x] Fix expiry batching by selecting and locking up to 100 available class rows in one FOR UPDATE SKIP LOCKED query.
- [x] Use PostgreSQL clock_timestamp() consistently for availability and hold operations.
- [x] Add regression tests for locked expiry batches and effective expiry reads.

### 8. Build the frontend foundation

- [x] Create a React and TypeScript frontend using Vite, plain CSS and shared request hooks.
- [x] Use English labels, header navigation, labelled forms, green accents and responsive tables.
- [x] Add the student-ID field, validation and safe identity switching.
- [x] Connect class creation, class listing and class details to the backend.
- [x] Include loading, empty, validation, server-error and retry states.
- [x] Verify the production build, keyboard navigation and mobile layout.

### 9. Complete admission and history flows

- [x] Connect seat application, simulated payment confirmation and cancellation.
- [x] Show application status and a countdown derived from the server's expiresAt value.
- [x] Poll visible views every five seconds and refresh on focus or countdown completion.
- [x] Prevent overlapping reads and duplicate pending actions; avoid automatically retrying uncertain writes.
- [x] Add My Applications with links to application details.
- [x] Restore the selected student through localStorage after refresh or browser reopening; retrieve application state from the API.
- [x] Verify confirmation, cancellation, expiry, conflicts and identity switching through the UI.

### 10. Package and test the complete frontend

- [x] Add a multi-stage frontend Dockerfile and serve static assets through Nginx.
- [x] Proxy /api requests to the backend using API_BASE_URL configured at container startup.
- [x] Add the frontend to root Compose so docker compose up starts the whole application.
- [x] Support direct application URLs and page reloads through SPA fallback.
- [x] Add nine deterministic Playwright tests for validation, actions, polling, errors and accessibility behaviour.
- [x] Add five real-stack browser journeys for confirmation/history, cancellation, expiry, last-seat competition and browser-session restoration.

### 11. Verify multiple backend instances

- [x] Run two independent API processes on container ports 8080 and 8081 against the same test database.
- [x] Send concurrent allocations across both APIs and verify held plus confirmed seats never exceed capacity.
- [x] Verify duplicate student requests across both APIs create only one active hold.
- [x] Explain database locking, worker coordination and relevant limits in ASSUMPTIONS.md.

### 12. Complete documentation and submission checks

- [x] Document Docker startup, frontend/backend URLs, configuration and test commands in README.md.
- [x] Record scope decisions and concurrency assumptions in ASSUMPTIONS.md.
- [x] Describe applicant direction, AI assistance and corrected mistakes in AI_USAGE.md.
- [x] Verify the public repository contains the source, migrations, Dockerfiles and automated tests.
- [x] Build and run both Docker test suites from a fresh GitHub clone: 25 backend tests and 14 frontend tests passed.
- [x] Verify that the renamed commit history leaves the tested application files unchanged.

## Verification commands

Run from the repository root with Docker available:

```sh
docker compose up
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.frontend-test.yml up --build --abort-on-container-exit --exit-code-from tests
```

The frontend runs at http://localhost:3000 and the API at http://localhost:8080. Create a class through the UI before applying; no initial classes are seeded. See [README.md](../README.md) for configuration and test cleanup instructions.
