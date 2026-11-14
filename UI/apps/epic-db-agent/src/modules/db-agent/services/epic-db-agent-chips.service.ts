import { Injectable } from '@nestjs/common'
import moment from 'moment/moment'
import { concat, delay, map, Observable, of, zipAll } from 'rxjs'
import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicChip,
    EpicChipCreateManyRequest,
    EpicChipCreateRequest,
    EpicChipLocationHistoryRecord,
} from 'svt-ts-types'
import { EpicGetAllChipsQueryFilter } from 'svt-ts-types/kafka'

import { EpicDbAgentAsicsService } from './epic-db-agent-asics.service'
import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentChipsService {

    protected chips: EpicChip[] = generateChips(10 * 1000)
    protected chipsLocationHistory: { [chipId: string]: EpicChipLocationHistoryRecord[] } = this.chips
        .reduce<{ [chipId: string]: EpicChipLocationHistoryRecord[] }>(
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

    constructor(private readonly epicDbAgentAsicsService: EpicDbAgentAsicsService) {
    }

    getAllChips(queryFilter?: EpicGetAllChipsQueryFilter, pager?: EpicApiPager): Observable<EpicApiPageResponse<EpicChip>> {
        const filteredData = queryFilter
            ? this.chips.filter(item => {
                const fulfilIdsFilter = !queryFilter.ids?.length || (queryFilter.ids.includes(item.id))
                const fulfilFamilyTypeFilter = !queryFilter.familyTypes?.length || (queryFilter.familyTypes.includes(item.familyType))
                const fulfilGeneralLocationFilter = !queryFilter.generalLocation
                    || (queryFilter.generalLocation === item.generalLocation)
                const fulfilSerialNumberFilter = !queryFilter.serialNumber || (item.serialNumber.includes(queryFilter.serialNumber))

                return fulfilIdsFilter
                    && fulfilFamilyTypeFilter
                    && fulfilGeneralLocationFilter
                    && fulfilSerialNumberFilter
            })
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

    getChipById(chipId: number): Observable<EpicChip | undefined> {
        return this.getAllChips({ ids: [chipId] })
            .pipe(
                map(list => list.items[0]),
            )
    }

    createChip(createRequest: EpicChipCreateRequest): Observable<EpicChip> {
        return this.epicDbAgentAsicsService.getAllAsics({ ids: [createRequest.asicId] })
            .pipe(
                map(list => {
                    if (!list.items.length) {
                        throw new Error(`Asic does not exist: ${createRequest.asicId}`)
                    }

                    const refAsic = list.items[0]

                    const newChip: EpicChip = {
                        id: (this.chips[this.chips.length - 1]?.id || 0) + 1,
                        ...createRequest,
                        familyType: refAsic.familyType,
                    }

                    this.chips.push(newChip)

                    return newChip
                }),
            )
            .pipe(
                delay(50),
            )
    }

    createMany(createRequest: EpicChipCreateManyRequest): Observable<EpicChip[]> {
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

    updateChip(chipId: number, updateRequest: Partial<Omit<EpicChip, 'id'>>): Observable<EpicChip | null> {
        let refChip: EpicChip = null

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

    getChipLocationHistory(chipId: number): Observable<EpicChipLocationHistoryRecord[]> {
        return of(this.chipsLocationHistory[chipId] ?? [])
            .pipe(
                delay(500),
            )
    }

    updateChipLocation(location: EpicChipLocationHistoryRecord): Observable<EpicChip> {
        this.chipsLocationHistory[location.chipId] = [
            ...(this.chipsLocationHistory[location.chipId] ?? []),
            location,
        ]

        return this.updateChip(location.chipId, { generalLocation: location.generalLocation })
    }

    // deleteChip(chipId: number): Observable<EpicChip> {
    //     const refChip: EpicChip = this.chips
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

export function generateChips(totalCount: number, idStartsFrom = 1): EpicChip[] {
    const result: EpicChip[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            serialNumber: `chip-${i}`,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            familyType: getEnumsCollection().asicFamilyType[0],
        })
    }

    return result

}
