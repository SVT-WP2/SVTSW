import { EpicApiPager } from 'epic-api-types'


export function getDefaultEpicApiPager(): EpicApiPager {
    return {
        limit: 1000,
        offset: 0,
    }
}
