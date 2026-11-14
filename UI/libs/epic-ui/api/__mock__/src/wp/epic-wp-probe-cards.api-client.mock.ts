import { Injectable } from '@angular/core'
import { EpicWpProbeCardsApiClient } from 'epic-ui/api'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'
import { EpicWpProbeCard } from 'svt-ts-types'


export function getMockEpicWpProbeCardsList(): EpicWpProbeCard[] {
    return [
        {
            id: 1,
            name: 'Probe Card #1',
            serialNumber: '123-123',
            vendor: 'Vendor Name',
            model: 'Model #1',
            location: 'CERN',
            arriveDate: '2025-05-01',
            type: 'Type #1',
            vendorCleaningInterval: 20,
        },
        {
            id: 2,
            name: 'Probe Card #2',
            serialNumber: '321-321',
            vendor: 'Vendor Name',
            model: 'Model #2',
            location: 'CERN',
            arriveDate: '2025-02-01',
            type: 'Type #2',
            vendorCleaningInterval: 20,
        },
    ]
}

@Injectable()
export class EpicWpProbeCardsApiClientMock extends EpicWpProbeCardsApiClient {

    protected entitiesList = getMockEpicWpProbeCardsList()

    override fetchAll(): Observable<EpicWpProbeCard[]> {
        return of(this.entitiesList)
            .pipe(
                delay(100),
            )
    }

    override fetchOne(entityId: number): Observable<EpicWpProbeCard> {
        return of(this.entitiesList.find(item => item.id === entityId)!)
            .pipe(
                switchMap((entity) =>
                    entity
                        ? of(entity)
                        : throwError(() => new Error(`Entity with id ${entityId} not found`)),
                ),
                delay(100),
            )
    }

}
