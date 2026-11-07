import { EpicAsic } from 'epic-api-types'


/**
 * An ASIC on the Kafka wire (DB agent ↔ BFF). Today it is exactly the HTTP contract type `EpicAsic` — the BFF
 * hands it to the UI untouched — so it is an alias rather than a second copy of the field list. Turn it back
 * into a real type the day the two shapes diverge (e.g. BFF-side enrichment the DB agent knows nothing about).
 */
export type EpicAsicEntity = EpicAsic
