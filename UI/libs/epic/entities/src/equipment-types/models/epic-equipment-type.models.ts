import { EpicEquipmentType, EpicEquipmentTypeCreateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicEquipmentTypeEntity = EpicEquipmentType

/** Payload of the `CreateEquipmentType` Kafka message — identical to the HTTP request body today. */
export type EpicEquipmentTypeCreateEntity = EpicEquipmentTypeCreateRequest
