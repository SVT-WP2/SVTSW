import { EpicEquipment, EpicEquipmentCreateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicEquipmentEntity = EpicEquipment

/** Payload of the `CreateEquipment` Kafka message — identical to the HTTP request body today. */
export type EpicEquipmentCreateEntity = EpicEquipmentCreateRequest
