import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigCreateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicSvtTestSetupConfigEntity = EpicSvtTestSetupConfig

export type EpicSvtTestSetupConfigBodyEntity = EpicSvtTestSetupConfigBody

/** Payload of the `CreateSvtTestSetupConfig` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestSetupConfigCreateEntity = EpicSvtTestSetupConfigCreateRequest
