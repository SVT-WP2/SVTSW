import { Injectable } from '@nestjs/common'
import moment from 'moment/moment'
import { delay, map, Observable, of } from 'rxjs'
import { EpicWafer, EpicWaferCreateRequest, EpicWaferLocationHistoryRecord } from 'svt-ts-types'
import { SvtDbAgentKafkaWafers } from 'svt-ts-types/kafka'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentUsersService, mockEpicDbAgentUserIdOf } from './epic-db-agent-users.service'


@Injectable()
export class EpicDbAgentWafersService {

    protected wafers: EpicWafer[] = generateWafers(10 * 1000)
    protected wafersLocationHistory: { [waferId: string]: EpicWaferLocationHistoryRecord[] } = this.wafers
        .reduce<{ [waferId: string]: EpicWaferLocationHistoryRecord[] }>(
            (acc, wafer) => {
                return {
                    ...acc,
                    [wafer.id]: [{
                        waferId: wafer.id,
                        generalLocation: wafer.generalLocation,
                        date: moment().subtract(Math.round(Math.random() * 100), 'days').format('YYYY-MM-DD'),
                        username: null,
                        note: 'Init location',
                        userId: mockEpicDbAgentUserIdOf(wafer.id),
                        userName: null,
                    }],
                }
            },
            {},
        )

    constructor(private readonly epicDbAgentUsersService: EpicDbAgentUsersService) {
    }

    getAllWafers(filter?: { ids?: number[] }): Observable<EpicWafer[]> {
        const result = filter?.ids
            ? this.wafers.filter(item => filter.ids.includes(item.id))
            : this.wafers

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getWaferById(waferId: number): Observable<EpicWafer | undefined> {
        return this.getAllWafers()
            .pipe(
                map(list => list.find(item => item.id === waferId)),
            )
    }

    createWafer(createRequest: EpicWaferCreateRequest): Observable<EpicWafer> {
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

    updateWafer(waferId: number, updateRequest: Partial<Omit<EpicWafer, 'id'>>): Observable<EpicWafer | null> {
        let refWafer: EpicWafer = null

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

    /** The name of the user of each row is read now, as the DB agent does: a renamed user shows its new name. */
    getWaferLocationHistory(waferId: number): Observable<EpicWaferLocationHistoryRecord[]> {
        const history = (this.wafersLocationHistory[waferId] ?? [])
            .map(record => ({ ...record, userName: this.epicDbAgentUsersService.nameOf(record.userId) }))
        return of(history)
            .pipe(
                delay(500),
            )
    }

    /** `userId`: the user of the header `svt_userId`, `null` without one. */
    updateWaferLocation(location: SvtDbAgentKafkaWafers.UpdateWaferLocationMessageData, userId: number | null): Observable<EpicWafer> {
        this.wafersLocationHistory[location.waferId] = [
            ...(this.wafersLocationHistory[location.waferId] ?? []),
            { ...location, username: location.username ?? null, userId, userName: null },
        ]

        return this.updateWafer(location.waferId, { generalLocation: location.generalLocation })
    }

    // deleteWafer(waferId: number): Observable<EpicWafer> {
    //     const refWafer: EpicWafer = this.wafers
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

export function generateWafers(totalCount: number, idStartsFrom = 1): EpicWafer[] {
    const result: EpicWafer[] = []

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
