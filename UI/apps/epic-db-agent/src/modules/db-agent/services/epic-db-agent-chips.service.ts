import { Injectable } from '@nestjs/common'
import {
    EpicChipCreateEntity,
    EpicChipCreateManyEntity,
    EpicChipEntity,
    EpicChipLocationHistoryRecordEntity,
    EpicGetAllChipsQueryFilter,
    EpicPageData,
    EpicPager,
} from 'epic/entities'
import moment from 'moment/moment'
import { concat, delay, map, Observable, of, zipAll } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentChipsService {

    protected chips: EpicChipEntity[] = generateChips(10 * 1000)
    protected chipsLocationHistory: { [chipId: string]: EpicChipLocationHistoryRecordEntity[] } = this.chips
        .reduce<{ [chipId: string]: EpicChipLocationHistoryRecordEntity[] }>(
            (acc, chip) => {
                return {
                    ...acc,
                    [chip.id]: [{
                        chipId: chip.id,
                        generalLocation: chip.generalLocation,
                        date: moment().subtract(Math.round(Math.random() * 100), 'days').format('YYYY-MM-DD'),
                        username: null,
                        note: 'Init location',
                    }],
                }
            },
            {},
        )

    getAllChips(filter?: EpicGetAllChipsQueryFilter, pager?: EpicPager): Observable<EpicPageData<EpicChipEntity>> {
        const filteredData = filter?.ids
            ? this.chips.filter(item => filter.ids.includes(item.id))
            : this.chips

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

    getChipById(chipId: number): Observable<EpicChipEntity | undefined> {
        return this.getAllChips({ ids: [chipId] })
            .pipe(
                map(list => list.items[0]),
            )
    }

    createChip(createRequest: EpicChipCreateEntity): Observable<EpicChipEntity> {
        const newChip = {
            id: (this.chips[this.chips.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.chips.push(newChip)

        return of(newChip)
            .pipe(
                delay(50),
            )
    }

    createMany(createRequest: EpicChipCreateManyEntity): Observable<EpicChipEntity[]> {
        return concat(
            createRequest.items
                .map(
                    item => this.createChip({ generalLocation: createRequest.generalLocation, ...item }),
                ),
        )
            .pipe(
                zipAll(),
            )
    }

    updateChip(chipId: number, updateRequest: Partial<Omit<EpicChipEntity, 'id'>>): Observable<EpicChipEntity | null> {
        let refChip: EpicChipEntity = null

        this.chips = this.chips
            .map(item => {
                if (item.id === chipId) {
                    refChip = {
                        ...item,
                        ...updateRequest,
                    }
                    return refChip
                }
                return item
            })

        return of(refChip)
            .pipe(
                delay(50),
            )
    }

    getChipLocationHistory(chipId: number): Observable<EpicChipLocationHistoryRecordEntity[]> {
        return of(this.chipsLocationHistory[chipId] ?? [])
            .pipe(
                delay(500),
            )
    }

    updateChipLocation(location: EpicChipLocationHistoryRecordEntity): Observable<EpicChipEntity> {
        this.chipsLocationHistory[location.chipId] = [
            ...(this.chipsLocationHistory[location.chipId] ?? []),
            location,
        ]

        return this.updateChip(location.chipId, { generalLocation: location.generalLocation })
    }

    // deleteChip(chipId: number): Observable<EpicChipEntity> {
    //     const refChip: EpicChipEntity = this.chips
    //         .find(item => item.id === chipId)
    //
    //     this.chips = this.chips
    //         .filter(item => item.id !== chipId)
    //
    //     return of(refChip)
    //         .pipe(
    //             delay(50),
    //         )
    // }

}

export function generateChips(totalCount: number, idStartsFrom = 1): EpicChipEntity[] {
    const result: EpicChipEntity[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            serialNumber: `chip-${i}`,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
        })
    }

    return result

}
