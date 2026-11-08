import { EpicApiPager } from 'svt-ts-types'


export function getDefaultEpicApiPager(): EpicApiPager {
    return {
        limit: 1000,
        offset: 0,
    }
}
