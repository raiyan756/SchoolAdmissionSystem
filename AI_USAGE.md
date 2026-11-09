# AI usage

OpenAI Codex assisted with assignment analysis, planning, backend/React implementation, Docker configuration, automated tests, review and documentation. Work was developed in milestones with separate commits. Private planning notes are excluded from Git.

The applicant requested a minimal school admission portal with simple navigation, labelled forms and restrained green accents, taking general layout inspiration from Bangladesh Railway's e-ticket site. The school branding and interface were implemented for this assignment; railway logos and imagery were not copied. The initial Bengali UI was changed to English at the applicant's request; the brief does not prescribe a UI language. The final interface uses system fonts without a remote font dependency.

## Mistakes found and corrected

- The first backend scaffold introduced more projects/abstractions than necessary. The applicant challenged the complexity. It was replaced with one API project containing controller, service and repository folders.
- Backend review found that taking the first 100 expiry candidates before skipping locked classes could starve an unlocked later class. An isolated reproduction and regression test demonstrated the failure. Candidate selection and locking now occur together in one `FOR UPDATE SKIP LOCKED` query.
- Review found inconsistent clocks: class availability used API-host time while hold operations used database time. Both now use PostgreSQL time. A regression test verifies effective expiry reads while the worker is blocked; OS clock skew itself was not injected.
- Browser testing caught mobile overflow caused by visually hidden table text escaping its scroll container. The layout was fixed, including compact mobile rows exposing all counts/actions, and the viewport/keyboard test passes.
- Frontend review found that aborting a slow GET on every polling tick could prevent completion. Polling now avoids overlapping reads, with cleanup on navigation/identity changes and a bounded timeout.

## Verification and limitations

The repository contains real PostgreSQL backend tests for concurrent allocation, duplicate identity, idempotency, lifecycle/expiry, locked-batch regression and two independent backend processes. Frontend tests cover contracts/validation, identity switching, pending actions, conflicts, confirmation, cancellation, countdown behaviour and mobile layout; browser journeys exercise the real Docker stack.

AI-assisted work was checked with builds, automated tests, browser interaction and database/API observations. These checks do not establish production-scale throughput, security certification or correctness for every possible failure. There is intentionally no real authentication or payment system in this assignment. The applicant should be able to explain the design and its trade-offs during the interview.
