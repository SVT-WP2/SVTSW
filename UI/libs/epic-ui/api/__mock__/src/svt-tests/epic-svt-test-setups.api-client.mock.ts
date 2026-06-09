import { inject, Injectable } from '@angular/core'
import {
    EpicSvtTestSetup,
    EpicSvtTestSetupConfigsApiClient,
    EpicSvtTestSetupCreate,
    EpicSvtTestSetupsApiClient,
    EpicSvtTestSetupUpdate,
} from 'epic-ui/api'
import { EpicEnumsMock } from 'epic-ui/api/__mock__'
import { delay, map, Observable, of, throwError } from 'rxjs'


export function getMockEpicSvtTestSetup(): EpicSvtTestSetup[] {
    return [
        {
            id: 1,
            name: 'Test setup #1',
            defaultConfigId: 1,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
        },
        {
            id: 2,
            name: 'Test setup #2',
            defaultConfigId: 2,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
        },
        {
            id: 3,
            name: 'Test setup #3',
            defaultConfigId: 3,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
        },
        {
            id: 4,
            name: 'Test setup #4',
            defaultConfigId: 4,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
        },
    ]
}

@Injectable()
export class EpicSvtTestSetupsApiClientMock extends EpicSvtTestSetupsApiClient {

    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)

    protected data: EpicSvtTestSetup[] = [...getMockEpicSvtTestSetup()]

    override fetchList(): Observable<EpicSvtTestSetup[]> {
        return of(this.data)
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicSvtTestSetupCreate): Observable<EpicSvtTestSetup> {
        const newSetupId = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        return this.epicSvtTestSetupConfigsApiClient
            .create({
                ...payload.defaultConfig,
                setupId: newSetupId,
            })
            .pipe(
                map((config) => {
                    const entity: EpicSvtTestSetup = {
                        id: newSetupId,
                        name: payload.name,
                        generalLocation: payload.generalLocation,
                        defaultConfigId: config.id,
                    }
                    this.data = [...this.data, entity]
                    return entity
                }),
                delay(500),
            )
    }

    override update(entityId: number, update: EpicSvtTestSetupUpdate): Observable<EpicSvtTestSetup> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }

        const entityUpdated: EpicSvtTestSetup =  {
            ...entity,
            ...update,
        }

        this.data = this.data
            .map(item => {
                if (item.id === entityId) {
                    return entityUpdated
                }
                return item
            })

        return of(entityUpdated)
    }

}

