import { EpicApiPager } from 'epic-api-types'


/** Paging on the Kafka wire (BFF → DB agent) — the same offset / limit pair the HTTP API takes. */
export type EpicPager = EpicApiPager
