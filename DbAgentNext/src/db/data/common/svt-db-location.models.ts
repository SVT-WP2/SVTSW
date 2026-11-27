/**
 * A location change of a wafer, chip, equipment or module: `date` omitted or `null` lets the database stamp
 * the current day; `username` and `note` are optional. `userId` is the user of the request (the id of a row of
 * `SvtUser`), `null` for a request without a user.
 */
export type SvtDbLocationInput = {
    generalLocation: string
    date?: string | null
    username?: string | null
    note?: string | null
    userId: number | null
}

/** The `note` of the history row written together with a new entity (the C++ agent's `createWithLocation`). */
export const SVT_DB_LOCATION_AT_CREATION_NOTE = 'Location at creation'
