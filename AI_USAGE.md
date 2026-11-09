# AI Usage

OpenAI Codex was used for backend and frontend implementation, Docker configuration, automated tests and documentation. Codex also assisted with technical suggestions and code review.

## Architectural decisions

I chose a single backend project with controller, service and repository layers. Controllers handle HTTP requests and responses, services manage business rules and transactions, and repositories handle database queries and persistence operations.

I requested the repository pattern and reviewed the implementation in milestones. Codex implemented the code under this direction. Services use the shared scoped DbContext for transactions and SaveChanges, keeping each business operation atomic.

Development followed a [step-by-step implementation plan](DOCS/IMPLEMENTATION_PLAN.md) with separate milestone commits.

## AI mistake identified and corrected

The initial AI-generated backend setup used four separate projects and several abstractions. While reviewing the folder structure against the assignment scope, I identified unnecessary complexity.

I asked Codex to replace it with one API project containing controller, service and repository layers. This retained clear responsibilities while reducing project and dependency overhead.

## Verification

The implementation was checked through code review, browser interaction and Docker-based automated tests. A fresh GitHub clone passed 25 backend tests and 14 frontend tests, including concurrency tests across two backend processes.
