# Shared

Code compiled into more than one deployable of SVTSW. Each top-level folder of the repository is a deployable;
this one is not, it has no build of its own.

| Folder | Holds | Consumers |
|---|---|---|
| [`svt-ts-types/`](svt-ts-types/README.md) | TypeScript contract types: the HTTP contract and the Kafka contract | `UI/` (SPA, BFF, mock DB agent), the NestJS DB agent |

Dependency-free source only: no npm imports, no decorators, no `node_modules`, no build output. A consumer
compiles the files with its own tools through a path alias; `svt-ts-types/README.md` lists what a consumer must set up.
