import { Injectable } from '@angular/core'
import {
    EpicWpProbeCardCreate,
    EpicWpProbeCardUpdate,
    EpicWpProbeCard,
    EpicWpProbeCardsApiClient,
} from 'epic-ui/api'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'


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

    override create(payload: EpicWpProbeCardCreate): Observable<EpicWpProbeCard> {
        const entity: EpicWpProbeCard = {
            ...payload,
            id: this.entitiesList.length ? this.entitiesList[this.entitiesList.length - 1].id + 1 : 1,
        }
        this.entitiesList = [...this.entitiesList, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override update(id: number, update: Partial<EpicWpProbeCardUpdate>): Observable<EpicWpProbeCard> {
        let refEntity: EpicWpProbeCard
        this.entitiesList = this.entitiesList.map(item => {
            if (item.id === id) {
                refEntity = {
                    ...item,
                    ...update,
                }
                return refEntity
            }
            return item
        })
        return of(refEntity!)
            .pipe(
                delay(500),
            )
    }

}
