import { EpicWaferLocationUpdateRequest } from 'epic-api-types'


/** Payload of the `UpdateWaferLocation` Kafka message — the HTTP request body plus the acting user. */
export type EpicWaferLocationUpdate = EpicWaferLocationUpdateRequest & {
    username: string | null
}
