import { inject, Injectable } from '@angular/core'
import {
    EpicSvtTestTemplate,
    EpicSvtTestTemplateCreate,
    EpicSvtTestTemplatesApiClient,
    EpicSvtTestTemplateUpdate,
    EpicSvtTestTypeConfigsApiClient,
} from 'epic-ui/api'
import { delay, map, Observable, of, switchMap, tap, throwError } from 'rxjs'

import { EpicEnumsMock } from '../enums'


export function getMockEpicSvtTestTemplates(): EpicSvtTestTemplate[] {
    return [
        {
            id: 1,
            dutType: EpicEnumsMock.getEnumsCollection().dutType[1],
            isEnabled: true,
            testTypeId: 1,
            testTypeConfigId: 1,
        },
        {
            id: 2,
            dutType: EpicEnumsMock.getEnumsCollection().dutType[0],
            isEnabled: true,
            testTypeId: 2,
            testTypeConfigId: 2,
        },
        {
            id: 3,
            dutType: EpicEnumsMock.getEnumsCollection().dutType[1],
            isEnabled: false,
            testTypeId: 3,
            testTypeConfigId: 3,
        },
    ]
}

@Injectable()
export class EpicSvtTestTemplatesApiClientMock extends EpicSvtTestTemplatesApiClient {

    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

    protected data: EpicSvtTestTemplate[] = [...getMockEpicSvtTestTemplates()]

    override fetchList(): Observable<EpicSvtTestTemplate[]> {
        return of(this.data)
            .pipe(
                delay(500),
            )
    }

    override fetchOne(entityId: number): Observable<EpicSvtTestTemplate> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }
        return of(entity).pipe(delay(300))
    }

    override create(payload: EpicSvtTestTemplateCreate): Observable<EpicSvtTestTemplate> {
        return this.epicSvtTestTypeConfigsApiClient.fetchOne(payload.testTypeConfigId)
            .pipe(
                switchMap(testTemplateConfig =>
                    testTemplateConfig
                        ? of(testTemplateConfig)
                        : throwError(() => new Error(`Test type config with id ${payload.testTypeConfigId} not found`)),
                ),
                map(testTemplateConfig => {
                    const newId = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
                    const entity: EpicSvtTestTemplate = {
                        id: newId,
                        dutType: payload.dutType,
                        isEnabled: payload.isEnabled,
                        testTypeId: testTemplateConfig.testTypeId,
                        testTypeConfigId: payload.testTypeConfigId,
                    }
                    return entity
                }),
                tap(entity => this.data.push(entity)),
                delay(500),
            )
    }

    override update(entityId: number, update: EpicSvtTestTemplateUpdate): Observable<EpicSvtTestTemplate> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }

        const entityUpdated: EpicSvtTestTemplate = {
            ...entity,
            ...update,
        }

        this.data = this.data.map(item => item.id === entityId ? entityUpdated : item)

        return of(entityUpdated).pipe(delay(500))
    }

}

