# epic/entities

Node-only code shared by `epic-measure-api` (the BFF) and `epic-db-agent` (the mock DB agent). Never imported
by the Angular app.

| Folder | Holds | Rule |
|---|---|---|
| `<domain>/models` | The **Kafka wire types** (DB agent ↔ BFF) that differ from the HTTP contract | A wire type that equals the HTTP contract type has no type of its own: the Kafka messages use the `epic-api-types` type directly (`EpicWafer`, `EpicWaferCreateRequest`). A type lives here only when the two shapes diverge — `EpicSvtTestEntity` (no `status`), the `*LocationUpdate` types (extra `username`) and the Kafka filters are the examples. |
| `<domain>/dtos` | `Epic<X>Dto`, `Epic<X>CreateRequestDto`, `Epic<X>sGetAllParamsDto` — the **HTTP shape** as decorated classes | Each one `implements` its `epic-api-types` type, so a field drifting from the contract fails to compile. They drive Swagger and the `ClassSerializerInterceptor`. |
| `kafka/` | Message envelopes, per-domain `SvtDbAgentKafka<X>` namespaces, reply helpers | The authoritative contract is `../Documentation/Kafka/svt.db-agent.kafka.yaml`. Kafka filter types (`EpicGetAll<X>QueryFilter`) stay here even when they look like the HTTP query — they belong to that contract. |

The field lists themselves live in `libs/epic-api-types` — see its README.
