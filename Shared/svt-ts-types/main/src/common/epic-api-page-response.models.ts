/**
 * The envelope every paginated `GET /api/...` list endpoint responds with.
 */
export type EpicApiPageResponse<T = unknown> = {
    items: T[]
    totalCount: number
}
