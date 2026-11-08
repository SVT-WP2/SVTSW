/** Offset paging as the Kafka messages carry it (`data.pager`); absent means every row. */
export type SvtDbPager = {
    limit: number
    offset: number
}

/** A page of a list reply: `{ items, totalCount }`, counted database-side. */
export type SvtDbPage<T> = {
    items: T[]
    totalCount: number
}

/** `pager` present without `limit`: the C++ agent's default page size. */
export const SVT_DB_DEFAULT_PAGE_LIMIT = 20
