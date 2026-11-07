import { EpicSvtTestType, EpicSvtTestTypeCreateRequest, EpicSvtTestTypesListQuery, EpicSvtTestTypeUpdateRequest } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicSvtTestTypeEntity = EpicSvtTestType

/** Payload of the `CreateSvtTestType` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestTypeCreateEntity = EpicSvtTestTypeCreateRequest

/** Payload of the `UpdateSvtTestType` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestTypeUpdateEntity = EpicSvtTestTypeUpdateRequest

/** The `GetAllSvtTestTypes` Kafka filter — identical to the HTTP query today. */
export type EpicSvtTestTypesGetAllParams = EpicSvtTestTypesListQuery
