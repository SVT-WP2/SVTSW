import {
    EpicSvtTestTypeConfig,
    EpicSvtTestTypeConfigBody,
    EpicSvtTestTypeConfigCreateRequest,
    EpicSvtTestTypeConfigsListQuery,
} from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicSvtTestTypeConfigEntity = EpicSvtTestTypeConfig

export type EpicSvtTestTypeConfigBodyEntity = EpicSvtTestTypeConfigBody

/** Payload of the `CreateSvtTestTypeConfig` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestTypeConfigCreateEntity = EpicSvtTestTypeConfigCreateRequest

/** The `GetAllSvtTestTypeConfigs` Kafka filter — identical to the HTTP query today. */
export type EpicSvtTestTypeConfigsGetAllParams = EpicSvtTestTypeConfigsListQuery
