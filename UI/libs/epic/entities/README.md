# epic/entities

Node-only code shared by `epic-measure-api` (the BFF) and `epic-db-agent` (the mock DB agent). Never imported
by the Angular app.

| Folder | Holds | Rule |
|---|---|---|
| `<domain>/dtos` | `Epic<X>Dto`, `Epic<X>CreateRequestDto`, `Epic<X>sGetAllParamsDto` — the **HTTP shape** as decorated classes | Each one `implements` its `svt-ts-types` type, so a field drifting from the contract fails to compile. They drive Swagger and the `ClassSerializerInterceptor`. |
| `svt-tests/models` | `resolveEpicSvtTestStatus()`, `resolveEpicSvtTestResultStatuses()` | The BFF-side mapping between the stored `testResultStatus` and the synthetic `status` of the HTTP contract. |
| `kafka/` | The helpers around the Kafka contract that need RxJS or NestJS: `mapEpicKafkaMessageData()`, `mapSvtDbAgentListReplyData()`, `mapSvtDbAgentEntityReplyData()`, `processKafkaReplyError()`, `EpicKafkaReplyMessageBusService` | The contract itself — message envelope, per-domain `SvtDbAgentKafka<X>` namespaces, wire types and Kafka filters — is dependency-free and lives in `svt-ts-types/kafka`. |

The field lists themselves live in `../Shared/svt-ts-types` — see its README.
