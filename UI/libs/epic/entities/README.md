# epic/entities

Node-only code shared by `epic-measure-api` (the BFF) and `epic-db-agent` (the mock DB agent). Never imported
by the Angular app.

| Folder | Holds | Rule |
|---|---|---|
| `<domain>/models` | `Epic<X>Entity`, `Epic<X>CreateEntity`, … — the **Kafka wire types** (DB agent ↔ BFF) | While a wire type equals the HTTP contract type, it is a one-line alias of the `epic-api-types` type (`type EpicWaferEntity = EpicWafer`). Turn it into a real type only when the two shapes diverge — `EpicSvtTestEntity` (no `status`) and the `*LocationUpdate` types (extra `username`) are the examples. |
| `<domain>/dtos` | `Epic<X>Dto`, `Epic<X>CreateRequestDto`, `Epic<X>sGetAllParamsDto` — the **HTTP shape** as decorated classes | Each one `implements` its `epic-api-types` type, so a field drifting from the contract fails to compile. They drive Swagger and the `ClassSerializerInterceptor`. |
| `kafka/` | Message envelopes, per-domain `SvtDbAgentKafka<X>` namespaces, reply helpers | The authoritative contract is `../Documentation/Kafka/svt.db-agent.kafka.yaml`. Kafka filter types (`EpicGetAll<X>QueryFilter`) stay here even when they look like the HTTP query — they belong to that contract. |

The field lists themselves live in `libs/epic-api-types` — see its README.
