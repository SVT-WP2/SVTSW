import { EpicWaferType, EpicWaferTypeCreateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicWaferTypeEntity = EpicWaferType

/** Payload of the `CreateWaferType` Kafka message — identical to the HTTP request body today. */
export type EpicWaferTypeCreateEntity = EpicWaferTypeCreateRequest
