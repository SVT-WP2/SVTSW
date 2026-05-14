import { Injectable } from '@angular/core'
import { EpicWafer, EpicWaferCreate, EpicWaferLocation, EpicWaferLocationUpdate, EpicWafersApiClient, EpicWaferUpdate } from 'epic-ui/api'
import moment from 'moment'
import { delay, Observable, of } from 'rxjs'

import { EpicEnumsMock } from '../enums'


export function getWafersList(totalCount: number, idStartsFrom = 1): EpicWafer[] {
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
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
        })
    }

    return result

}

@Injectable({ providedIn: 'root' })
export class EpicWafersApiClientMock extends EpicWafersApiClient {

    protected wafers = getWafersList(1000 * 10)
    protected wafersLocationHistory: { [waferId: string]: EpicWaferLocation[] } = this.wafers
        .reduce<{ [waferId: string]: EpicWaferLocation[] }>(
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

    override fetchAll(): Observable<EpicWafer[]> {
        return of(this.wafers)
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicWaferCreate): Observable<EpicWafer> {
        const newWafer = {
            ...payload,
            id: this.wafers.length ? this.wafers[this.wafers.length - 1].id + 1 : 1,
        }
        this.wafers.push(newWafer)

        return of(newWafer)
            .pipe(
                delay(500),
            )
    }

    override update(id: number, update: EpicWaferUpdate): Observable<EpicWafer> {
        return this.genericUpdate(id, update)
    }

    override fetchOne(waferId: number): Observable<EpicWafer> {
        const refWafer = this.wafers.find(item => item.id === waferId)!
        return of(refWafer)
            .pipe(
                delay(500),
            )
    }

    override deleteOne(id: number): Observable<EpicWafer> {
        const refWafer = this.wafers.find(item => item.id === id)!
        this.wafers = this.wafers.filter(item => item.id !== id)
        return of(refWafer)
            .pipe(
                delay(500),
            )
    }

    override fetchWaferLocationHistory(waferId: number): Observable<EpicWaferLocation[]> {
        return of(this.wafersLocationHistory[waferId] ?? [])
            .pipe(
                delay(500),
            )
    }

    override updateWaferLocation(id: number, update: EpicWaferLocationUpdate): Observable<EpicWafer> {
        const newWaferLocation: EpicWaferLocation = {
            ...update,
            waferId: id,
            username: null,
        }

        this.wafersLocationHistory[id] = [
            ...(this.wafersLocationHistory[id] ?? []),
            newWaferLocation,
        ]

        return this.genericUpdate(id, { generalLocation: update.generalLocation })
    }

    private genericUpdate(id: number, update: Partial<EpicWafer>): Observable<EpicWafer> {
        let refWafer: EpicWafer
        this.wafers = this.wafers.map(item => {
            if (item.id === id) {
                refWafer = {
                    ...item,
                    ...update,
                }
                return refWafer
            }
            return item
        })
        return of(refWafer!)
            .pipe(
                delay(500),
            )
    }


}
