import { Injectable } from '@angular/core'
import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicChipBlock,
    EpicChipBlocksApiClient,
    EpicChipBlocksListQuery,
    getDefaultEpicApiPager,
} from 'epic-ui/api'
import { delay, Observable, of, throwError } from 'rxjs'

import { EpicEnumsMock } from '../enums'


export function generateMockChipBlocks(totalCount: number, idStartsFrom = 1): EpicChipBlock[] {
    const blockTypes = EpicEnumsMock.getEnumsCollection().blockType
    const result: EpicChipBlock[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            // several blocks belong to the same chip, mirroring the real one-to-many relation
            chipId: Math.ceil(i / blockTypes.length),
            chipBlockType: blockTypes[i % blockTypes.length],
            serialNumber: `chip-block-${i}`,
        })
    }

    return result
}

@Injectable()
export class EpicChipBlocksApiClientMock extends EpicChipBlocksApiClient {

    protected entities: EpicChipBlock[] = [...generateMockChipBlocks(2 * 1000)]

    override fetchList(
        queryFilter?: Partial<EpicChipBlocksListQuery.QueryFilter>,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicChipBlock>> {

        const filteredData = queryFilter
            ? this.entities.filter(item => {
                const fulfilIdsFilter = !queryFilter.ids?.length || (queryFilter.ids.includes(item.id))
                const fulfilChipIdFilter = !queryFilter.chipId || (queryFilter.chipId === item.chipId)
                const fulfilChipBlockTypeFilter = !queryFilter.chipBlockTypes?.length
                    || (queryFilter.chipBlockTypes.includes(item.chipBlockType))
                const fulfilSerialNumberFilter = !queryFilter.serialNumber
                    || (item.serialNumber.toLowerCase().includes(queryFilter.serialNumber.toLowerCase()))

                return fulfilIdsFilter
                    && fulfilChipIdFilter
                    && fulfilChipBlockTypeFilter
                    && fulfilSerialNumberFilter
            })
            : this.entities

        const pagerDto = { ...getDefaultEpicApiPager(), ...(pager || {}) }
        const pageData = filteredData.slice(pagerDto.offset, pagerDto.offset + pagerDto.limit)

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
            .pipe(
                delay(500),
            )
    }

    override fetchOne(entityId: number): Observable<EpicChipBlock> {
        const entity = this.entities.find(item => item.id === entityId)

        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }

        return of(entity)
            .pipe(
                delay(300),
            )
    }

}
