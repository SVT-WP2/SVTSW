import { EpicAsicCreateRequest } from 'epic-api-types'


/** Payload of the `CreateAsic` Kafka message — today identical to the HTTP request body, see `EpicAsicEntity`. */
export type EpicAsicCreateEntity = EpicAsicCreateRequest
