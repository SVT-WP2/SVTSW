import { Injectable } from '@nestjs/common'
import { EpicChipBlockEntity, EpicGetAllChipBlocksQueryFilter } from 'epic/entities'
import { delay, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentChipBlocksService {

    protected chipBlocks: EpicChipBlockEntity[] = generateChipBlocks(2 * 1000)

    getAll(queryFilter?: EpicGetAllChipBlocksQueryFilter): Observable<EpicChipBlockEntity[]> {
        const result = this.chipBlocks
            .filter(item =>
                (!queryFilter?.ids?.length || queryFilter.ids.includes(item.id))
                && (!queryFilter?.chipId || queryFilter.chipId === item.chipId)
                && (!queryFilter?.blockTypes?.length || queryFilter.blockTypes.includes(item.chipBlockType)),
            )

        return of(result)
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
