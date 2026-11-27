import { EpicChipLocationUpdateRequest } from 'svt-ts-types'


/**
 * The HTTP request body plus `username`, free text that the history row stores as sent. The user of the request is
 * not part of it: it travels in the header `svt_userId`.
 */
export type EpicChipLocationUpdate = EpicChipLocationUpdateRequest & {
    username: string | null
}
