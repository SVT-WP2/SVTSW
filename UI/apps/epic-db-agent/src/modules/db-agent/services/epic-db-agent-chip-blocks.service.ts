import { Injectable } from '@nestjs/common'
import { EpicChipBlockEntity, EpicGetAllChipBlocksQueryFilter, EpicPageData, EpicPager } from 'epic/entities'
import { delay, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentChipBlocksService {

    protected chipBlocks: EpicChipBlockEntity[] = generateChipBlocks(2 * 1000)

    getAll(
        queryFilter?: EpicGetAllChipBlocksQueryFilter,
        pager?: EpicPager): Observable<EpicPageData<EpicChipBlockEntity>> {

        const filteredData = queryFilter
            ? this.chipBlocks.filter(item => {
                const fulfilIdsFilter = !queryFilter.ids?.length || (queryFilter.ids.includes(item.id))
                const fulfilChipIdFilter = !queryFilter.chipId || (queryFilter.chipId === item.chipId)
                const fulfilChipBlockTypeFilter = !queryFilter.chipBlockTypes?.length
                    || (queryFilter.chipBlockTypes.includes(item.chipBlockType))
                const fulfilSerialNumberFilter = !queryFilter.serialNumber || (item.serialNumber.includes(queryFilter.serialNumber))

                return fulfilIdsFilter
                    && fulfilChipIdFilter
                    && fulfilChipBlockTypeFilter
                    && fulfilSerialNumberFilter
            })
            : this.chipBlocks

        const pageData = pager
            ? filteredData.slice(pager.offset, pager.offset + pager.limit)
            : filteredData

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
            .pipe(
                delay(50),
            )
    }

}

export function generateChipBlocks(totalCount: number, idStartsFrom = 1): EpicChipBlockEntity[] {
    const blockTypes = getEnumsCollection().blockType
    const result: EpicChipBlockEntity[] = []

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
