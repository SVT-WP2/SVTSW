import { EpicSvtTestSetup, EpicSvtTestSetupCreateRequest, EpicSvtTestSetupUpdateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicSvtTestSetupEntity = EpicSvtTestSetup

/** Payload of the `CreateSvtTestSetup` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestSetupCreateEntity = EpicSvtTestSetupCreateRequest

/** Payload of the `UpdateSvtTestSetup` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestSetupUpdateEntity = EpicSvtTestSetupUpdateRequest
