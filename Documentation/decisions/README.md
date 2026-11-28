# Decisions

Dated records of decisions that span more than one service: what was decided, why, and what follows from it. A
decision inside one service is recorded in that service's docs.

One file per decision, named `<yyyy-mm>-<topic>.md`. A record is not rewritten when the decision changes: the new
decision gets its own file, and the old one gets a line at the top pointing to it.

| Record | Decision |
|---|---|
| [2026-11-db-agent-clone.md](2026-11-db-agent-clone.md) | Development of the DB agent continues in `DbAgentNext/`; the C++ `DbAgent/` is frozen. Completed by the next record |
| [2026-11-db-agent-next-only.md](2026-11-db-agent-next-only.md) | `svt-db-agent-next` is the DB agent of every environment, and the C++ agent gets no support; the docs of the DB agent stand alone; the schema authority is `DbAgentNext/docs/database-schema.md`, and a schema change is proposed on that page |
| [2026-11-repository-layout.md](2026-11-repository-layout.md) | The DB agent is a standalone app at the top level (`DbAgentNext/`); the contract types that it shares with the UI workspace are in `Shared/svt-ts-types` |
| [2026-11-wp-tool-phase-1.md](2026-11-wp-tool-phase-1.md) | The WP tool `wptool`: a stateless command-line tool for the wafer prober, built side by side with WPAgent; step 1 takes over only the commands that production uses; the code it shares with WPAgent goes to `Shared/svt-wp-core`, a Python package. Extends the repository-layout record |
| [2026-11-wp-state.md](2026-11-wp-state.md) | Which part of the prober's state lives where: SENTIO holds the physical state, the new WP agent its live view in memory, the DB the setup, a new alignment table, sessions and history; the WP tool keeps only its connection |
| [2026-11-users-and-roles.md](2026-11-users-and-roles.md) | One user list with four roles in the database of the installation; the BFF logs people in; the user of a Kafka request travels in the header `svt_userId`; the DB agent stores the user id and checks no role |
