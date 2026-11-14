import { EpicEnumName } from '../enums'


/** Enum values keyed by enum name. */
export type EpicEnumsCollection = Record<EpicEnumName, string[]>

/**
 * Response of `GET /api/enums` — only the enums asked for through `EpicEnumsCollectionQuery.enumNames` are
 * present, all of them when the query is empty.
 */
export type EpicEnumsCollectionResponse = {
    collection: Partial<EpicEnumsCollection>
}
