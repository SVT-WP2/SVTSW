/**
 * Query string of `GET /api/enums`.
 */
export type EpicEnumsCollectionQuery = {
    /**
     * Values of `EpicEnumName`. On the wire it is ONE comma-separated `enumNames` param (the API splits it),
     * not a repeated param. Omitted = every enum.
     */
    enumNames?: string[]
}
