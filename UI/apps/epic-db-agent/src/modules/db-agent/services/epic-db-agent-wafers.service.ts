import { Injectable } from '@nestjs/common'
import { EpicWaferCreateEntity, EpicWaferEntity, EpicWaferLocationHistoryRecordEntity } from 'epic/entities'
import moment from 'moment/moment'
import { delay, map, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentWafersService {

    protected wafers: EpicWaferEntity[] = generateWafers(10 * 1000)
    protected wafersLocationHistory: { [waferId: string]: EpicWaferLocationHistoryRecordEntity[] } = this.wafers
        .reduce<{ [waferId: string]: EpicWaferLocationHistoryRecordEntity[] }>(
            (acc, wafer) => {
                return {
                    ...acc,
                    [wafer.id]: [{
                        waferId: wafer.id,
                        generalLocation: wafer.generalLocation,
                        date: moment().subtract(Math.round(Math.random() * 100), 'days').format('YYYY-MM-DD'),
                        username: null,
                        note: 'Init location',
                    }],
                }
            },
            {},
        )

    getAllWafers(filter?: { ids?: number[] }): Observable<EpicWaferEntity[]> {
        const result = filter?.ids
            ? this.wafers.filter(item => filter.ids.includes(item.id))
            : this.wafers

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getWaferById(waferId: number): Observable<EpicWaferEntity | undefined> {
        return this.getAllWafers()
            .pipe(
                map(list => list.find(item => item.id === waferId)),
            )
    }

    createWafer(createRequest: EpicWaferCreateEntity): Observable<EpicWaferEntity> {
        const newWafer = {
            id: (this.wafers[this.wafers.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.wafers.push(newWafer)

        return of(newWafer)
            .pipe(
                delay(50),
            )
    }

    updateWafer(waferId: number, updateRequest: Partial<Omit<EpicWaferEntity, 'id'>>): Observable<EpicWaferEntity | null> {
        let refWafer: EpicWaferEntity = null

        this.wafers = this.wafers
            .map(item => {
                if (item.id === waferId) {
                    refWafer = {
                        ...item,
                        ...updateRequest,
                    }
                    return refWafer
                }
                return item
            })

        return of(refWafer)
            .pipe(
                delay(50),
            )
    }

    getWaferLocationHistory(waferId: number): Observable<EpicWaferLocationHistoryRecordEntity[]> {
        return of(this.wafersLocationHistory[waferId] ?? [])
            .pipe(
                delay(500),
            )
    }

    updateWaferLocation(location: EpicWaferLocationHistoryRecordEntity): Observable<EpicWaferEntity> {
        this.wafersLocationHistory[location.waferId] = [
            ...(this.wafersLocationHistory[location.waferId] ?? []),
            location,
        ]

        return this.updateWafer(location.waferId, { generalLocation: location.generalLocation })
    }

    // deleteWafer(waferId: number): Observable<EpicWaferEntity> {
    //     const refWafer: EpicWaferEntity = this.wafers
    //         .find(item => item.id === waferId)
    //
    //     this.wafers = this.wafers
    //         .filter(item => item.id !== waferId)
    //
    //     return of(refWafer)
    //         .pipe(
    //             delay(50),
    //         )
    // }

}

export function generateWafers(totalCount: number, idStartsFrom = 1): EpicWaferEntity[] {
    const result: EpicWaferEntity[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            serialNumber: `wafer-${i}`,
            batchNumber: 4,
            thinningDate: '2025-01-25',
            dicingDate: '2025-01-25',
            productionDate: '2025-01-25',
            waferTypeId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
        })
    }

    return result

}
