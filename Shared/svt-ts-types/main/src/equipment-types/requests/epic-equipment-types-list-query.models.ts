/**
 * Query string of `GET /api/equipment-types` — omitted / `null` / empty means "every equipment type".
 */
export type EpicEquipmentTypesListQuery = {
    ids?: number[] | null
}
