import { Injectable } from '@nestjs/common'
import {
    EpicSvtTestTemplateCreateEntity,
    EpicSvtTestTemplateEntity,
    EpicSvtTestTemplatesGetAllParams,
    EpicSvtTestTemplateUpdateEntity,
} from 'epic/entities'
import { delay, map, Observable, of, tap } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentSvtTestTypeConfigsService } from './epic-db-agent-svt-test-type-configs.service'


@Injectable()
export class EpicDbAgentSvtTestTemplatesService {

    protected data: EpicSvtTestTemplateEntity[] = [
        {
            id: 1,
            dutType: getEnumsCollection().dutType[1],
            isEnabled: true,
            testTypeId: 1,
            testTypeConfigId: 1,
        },
        {
            id: 2,
            dutType: getEnumsCollection().dutType[1],
            isEnabled: false,
            testTypeId: 2,
            testTypeConfigId: 2,
        },
    ]

    constructor(private readonly epicDbAgentSvtTestTypeConfigsService: EpicDbAgentSvtTestTypeConfigsService) {
    }

    getAll(queryFilter?: EpicSvtTestTemplatesGetAllParams): Observable<EpicSvtTestTemplateEntity[]> {
        const result = this.data
            .filter(item =>
                (!queryFilter?.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter?.dutTypes || queryFilter.dutTypes.includes(item.dutType)),
            )

        return of(result)
            .pipe(
                delay(50),
            )
    }

    create(createRequest: EpicSvtTestTemplateCreateEntity): Observable<EpicSvtTestTemplateEntity> {
        return this.epicDbAgentSvtTestTypeConfigsService.getOneById(createRequest.testTypeConfigId)
            .pipe(
                map(testTemplateConfig => ({
                    id: (this.data[this.data.length - 1]?.id || 0) + 1,
                    isEnabled: createRequest.isEnabled,
                    dutType: createRequest.dutType,
                    testTypeId: testTemplateConfig.testTypeId,
                    testTypeConfigId: createRequest.testTypeConfigId,
                })),
                tap(newEntity => this.data.push(newEntity)),
                delay(50),
            )
    }

    update(id: number, updateRequest: EpicSvtTestTemplateUpdateEntity): Observable<EpicSvtTestTemplateEntity | null> {
        let refEntity: EpicSvtTestTemplateEntity = null

        this.data = this.data
            .map(item => {
                if (item.id === id) {
                    refEntity = {
                        ...item,
                        ...updateRequest,
                    }
                    return refEntity
                }
                return item
            })

        return of(refEntity)
            .pipe(
                delay(50),
            )
    }

}

