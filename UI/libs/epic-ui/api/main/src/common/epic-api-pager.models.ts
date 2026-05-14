export type EpicApiPager = {
    limit: number
    offset: number
}

export function getDefaultEpicApiPager(): EpicApiPager {
    return {
        limit: 1000,
        offset: 0,
    }
}
