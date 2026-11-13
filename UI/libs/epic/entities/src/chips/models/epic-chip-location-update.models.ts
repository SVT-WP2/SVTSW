import { EpicChipLocationUpdateRequest } from 'epic-api-types'


/** Payload of the `UpdateChipLocation` Kafka message — the HTTP request body plus the acting user. */
export type EpicChipLocationUpdate = EpicChipLocationUpdateRequest & {
    username: string | null
}
