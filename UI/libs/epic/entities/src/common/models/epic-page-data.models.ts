import { EpicApiPageResponse } from 'epic-api-types'


/** A page of entities on the Kafka wire (DB agent → BFF) — the same envelope the HTTP API returns. */
export type EpicPageData<T = unknown> = EpicApiPageResponse<T>
