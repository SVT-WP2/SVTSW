import { EpicEquipmentLocationUpdateRequest } from 'epic-api-types'


/** Payload of the `UpdateEquipmentLocation` Kafka message — the HTTP request body plus the acting user. */
export type EpicEquipmentLocationUpdate = EpicEquipmentLocationUpdateRequest & {
    username: string | null
}
