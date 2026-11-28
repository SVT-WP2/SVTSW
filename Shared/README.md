# Shared

Code compiled into more than one deployable of SVTSW. Each top-level folder of the repository is a deployable;
this one is not, it has no build of its own.

| Folder | Holds | Consumers |
|---|---|---|
| [`svt-ts-types/`](svt-ts-types/README.md) | TypeScript contract types: the HTTP contract and the Kafka contract | `UI/` (SPA, BFF, mock DB agent), the NestJS DB agent |
| [`svt-wp-core/`](svt-wp-core/README.md) | Python: the code of WPAgent shared with the WP tool (the prober interface, the SENTIO driver, the die maps) | the WP tool (`WPTool/`); WPAgent after [#414](https://github.com/SVT-WP2/SVTSW/issues/414) |

The rule of `svt-ts-types/`: dependency-free source only, no npm imports, no decorators, no `node_modules`, no build
output. A consumer compiles the files with its own tools through a path alias; `svt-ts-types/README.md` lists what a
consumer must set up.

`svt-wp-core/` is an installable Python package: a consumer installs it from its folder in the repository, never from
PyPI (`svt-wp-core/README.md`). The pipelines and the images of the UI and the DB agent take `svt-ts-types/` only, so a
change of the Python package does not build or deploy them.
