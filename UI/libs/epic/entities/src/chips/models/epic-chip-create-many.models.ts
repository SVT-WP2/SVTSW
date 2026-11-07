import { EpicChipCreateManyRequest, EpicChipCreateManyRequestItem } from 'epic-api-types'


/** Payload of the `CreateManyChips` Kafka message — identical to the HTTP request body today. */
export type EpicChipCreateManyEntity = EpicChipCreateManyRequest

export type EpicChipCreateManyItemEntity = EpicChipCreateManyRequestItem
