# AI usage

OpenAI Codex assisted with assignment analysis, planning, backend/React implementation, Docker configuration, automated tests, review and documentation. Work followed a [step-by-step implementation plan](DOCS/IMPLEMENTATION_PLAN.md) with separate milestone commits.

The user provided the architectural direction and made the final design decisions, including the controller-service-repository structure and frontend preferences. OpenAI Codex implemented the application according to that direction, with technical suggestions and verification during development.

## Mistakes found and corrected

- Backend review found that taking the first 100 expiry candidates before skipping locked classes could starve an unlocked later class. An isolated reproduction and regression test demonstrated the failure. Candidate selection and locking now occur together in one `FOR UPDATE SKIP LOCKED` query.
- Review found inconsistent clocks: class availability used API-host time while hold operations used database time. Both now use PostgreSQL time. A regression test verifies effective expiry reads while the worker is blocked; OS clock skew itself was not injected.
- Browser testing caught mobile overflow caused by visually hidden table text escaping its scroll container. The layout was fixed, including compact mobile rows exposing all counts/actions, and the viewport/keyboard test passes.
- Frontend review found that aborting a slow GET on every polling tick could prevent completion. Polling now avoids overlapping reads, with cleanup on navigation/identity changes and a bounded timeout.
- Final comparison with the brief caught a persistence mismatch: `sessionStorage` remembered the selected student only for that tab session. The brief also requires recovering applications after closing/reopening the browser. This was changed to `localStorage`, with a browser-session restoration test; application data still comes from PostgreSQL.

## Verification and limitations

The repository contains real PostgreSQL backend tests for concurrent allocation, duplicate identity, idempotency, lifecycle/expiry, locked-batch regression and two independent backend processes. Frontend tests cover contracts/validation, identity switching, pending actions, conflicts, confirmation, cancellation, countdown behaviour and mobile layout; browser journeys exercise the real Docker stack.

AI-assisted work was checked with builds, automated tests, browser interaction and database/API observations. These checks do not establish production-scale throughput, security certification or correctness for every possible failure. There is intentionally no real authentication or payment system in this assignment.
