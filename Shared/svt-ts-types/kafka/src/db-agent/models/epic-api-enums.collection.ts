/**
 * Enum values keyed by enum name, as the DB agent serves them over Kafka. Keyed by `string` on purpose: the DB
 * agent may serve more enums than the UI knows (`EpicEnumName` in `svt-ts-types` lists the known ones).
 */
export type EpicApiEnumsCollection = Record<string, string[]>
