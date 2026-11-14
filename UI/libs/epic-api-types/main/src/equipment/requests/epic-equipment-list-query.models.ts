/**
 * Query string of `GET /api/equipment` — omitted / `null` / empty means "every piece of equipment".
 */
export type EpicEquipmentListQuery = {
    ids?: number[] | null
}
