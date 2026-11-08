# SVTSW

Main document:https://docs.google.com/document/d/1wN6vaUZ23X9be-_AlNE7BUaEvtTiSNiEHDwKGDnGyJQ/edit?tab=t.0
At the moment this repository will contain all the software needed for the SVTSoftware without separation. SubRepositories are expected to appear later
The Folder distribution is:

- UI
- DBAgent (the C++ DB Agent: frozen since 2026-11-15, without support, see Documentation/decisions/2026-11-db-agent-next-only.md)
- DbAgentNext (the DB Agent of every environment, NestJS; its docs hold the data model and the database schema, see DbAgentNext/README.md)
- Shared (code compiled into more than one of the folders above, see Shared/README.md)
- WPAgent
- TestAgent
- ITS3TestAgent
- Documentation (what spans services: overview, domain model, glossary, flows, decisions, Kafka contracts; see Documentation/README.md)
- Configurations (wafer maps and other configuration files)
- Environment (the compose stacks of the dev and prod servers, see Environment/README.md)
- Dev (the local stack and the database dumps, see Dev/README.md)
- Utilities
- ExternalDrivers
- SVTSupervisor

Start with Documentation/system-overview.md: it shows the services and how they talk to each other.

Responsible for each folder:
- UI, DbAgentNext and Shared ok-cern
- DB and DBAgent ycorrales
- WPAgent leyreflores, angie-kistina
- Documentation leyreflores (Kafka, WaferMap, AncillaryASICs) and ok-cern (README, overview, domain model, glossary, flows, decisions)
- SVTSupervisor icali
- ExternalDrivers icali

