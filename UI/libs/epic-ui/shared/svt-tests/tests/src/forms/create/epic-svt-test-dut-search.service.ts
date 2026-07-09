import { inject, Injectable } from '@angular/core'
import {
    EpicApiPager,
    EpicAsic,
    EpicAsicsApiClient,
    EpicChip,
    EpicChipBlock,
    EpicChipsApiClient,
    EpicSvtDutEntityName,
} from 'epic-ui/api'
import { EpicChipBlocksFacade } from 'epic-ui/shared'
import { map, Observable } from 'rxjs'

import { EpicSvtTestCreateForm } from './epic-svt-test-create-form.models'

import Form = EpicSvtTestCreateForm


/**
 * Feeds the DUT selector of the create form. The ASIC / chip tables are far too large to prefetch, so the
 * options are (re)fetched on every search term change and capped at the first {@link SEARCH_RESULT_LIMIT} hits.
 */
@Injectable({ providedIn: 'root' })
export class EpicSvtTestDutSearchService {

    static readonly SEARCH_RESULT_LIMIT = 10

    // DI
    protected readonly epicAsicsApiClient = inject(EpicAsicsApiClient)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly epicChipBlocksFacade = inject(EpicChipBlocksFacade)

    search(dutEntityName: EpicSvtDutEntityName, searchTerm?: string | null): Observable<Form.DutOption[]> {

        const pager: EpicApiPager = { offset: 0, limit: EpicSvtTestDutSearchService.SEARCH_RESULT_LIMIT }
        const serialNumber = searchTerm?.trim() || null

        switch (dutEntityName) {
            case EpicSvtDutEntityName.Asic:
                return this.searchAsics(serialNumber, pager)
            case EpicSvtDutEntityName.Chip:
                return this.searchChips(serialNumber, pager)
            case EpicSvtDutEntityName.ChipBlock:
                return this.searchChipBlocks(serialNumber)
        }
    }

    protected searchAsics(serialNumber: string | null, pager: EpicApiPager): Observable<Form.DutOption[]> {
        return this.epicAsicsApiClient.fetchAsicsList({ serialNumber }, pager)
            .pipe(
                map(response => response.items.map(toDutOption)),
            )
    }

    protected searchChips(serialNumber: string | null, pager: EpicApiPager): Observable<Form.DutOption[]> {
        return this.epicChipsApiClient.fetchChipsList({ serialNumber }, pager)
            .pipe(
                map(response => response.items.map(toDutOption)),
            )
    }

    /**
     * Unlike ASICs and chips, chip blocks cannot be searched or paged server side — the `GetAllChipBlocks`
     * Kafka contract exposes no serial number filter. The facade fetches the list once and caches it; the
     * search term is applied here.
     */
    protected searchChipBlocks(serialNumber: string | null): Observable<Form.DutOption[]> {
        const searchTerm = serialNumber?.toLowerCase()

        return this.epicChipBlocksFacade.fetchAll()
            .pipe(
                map(chipBlocks => chipBlocks
                    .filter(item => !searchTerm || item.serialNumber.toLowerCase().includes(searchTerm))
                    .slice(0, EpicSvtTestDutSearchService.SEARCH_RESULT_LIMIT)
                    .map(chipBlockToDutOption),
                ),
            )
    }

}

export function toDutOption(entity: EpicAsic | EpicChip): Form.DutOption {
    return {
        id: entity.id,
        serialNumber: entity.serialNumber,
        familyType: entity.familyType,
    }
}

export function chipBlockToDutOption(entity: EpicChipBlock): Form.DutOption {
    return {
        id: entity.id,
        serialNumber: entity.serialNumber,
        // a chip block carries its type in chipBlockType — that is what test templates match a chip block DUT on
        familyType: entity.chipBlockType,
    }
}
