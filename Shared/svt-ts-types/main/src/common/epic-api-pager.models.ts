/**
 * Offset / limit paging as every paginated `GET /api/...` list endpoint accepts it in the query string.
 */
export type EpicApiPager = {
    limit: number
    offset: number
}
