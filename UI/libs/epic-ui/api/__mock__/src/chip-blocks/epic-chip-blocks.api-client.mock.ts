import { Injectable } from '@angular/core'
import { EpicChipBlock, EpicChipBlocksApiClient, EpicChipBlocksListQuery } from 'epic-ui/api'
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

    override fetchList(queryFilter: EpicChipBlocksListQuery.QueryFilter = {}): Observable<EpicChipBlock[]> {
        const filteredData = this.entities.filter(item =>
            (!queryFilter.ids?.length || queryFilter.ids.includes(item.id))
            && (!queryFilter.chipId || queryFilter.chipId === item.chipId)
            && (!queryFilter.blockTypes?.length || queryFilter.blockTypes.includes(item.chipBlockType)),
        )

        return of(filteredData)
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
