import {
    EpicSvtTestTemplate,
    EpicSvtTestTemplateCreateRequest,
    EpicSvtTestTemplatesListQuery,
    EpicSvtTestTemplateUpdateRequest,
} from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicSvtTestTemplateEntity = EpicSvtTestTemplate

/** Payload of the `CreateSvtTestTemplate` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestTemplateCreateEntity = EpicSvtTestTemplateCreateRequest

/** Payload of the `UpdateSvtTestTemplate` Kafka message — identical to the HTTP request body today. */
export type EpicSvtTestTemplateUpdateEntity = EpicSvtTestTemplateUpdateRequest

/** The `GetAllSvtTestTemplates` Kafka filter — identical to the HTTP query today. */
export type EpicSvtTestTemplatesGetAllParams = EpicSvtTestTemplatesListQuery
