import { Injectable } from '@nestjs/common'
import { EpicSvtTestSetupCreateEntity, EpicSvtTestSetupEntity } from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentSvtTestSetupConfigsService } from './epic-db-agent-svt-test-setup-configs.service'


@Injectable()
export class EpicDbAgentSvtTestSetupService {

    protected data: EpicSvtTestSetupEntity[] = [
        {
            id: 1,
            name: 'Test setup #1',
            defaultConfigId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
        },
        {
            id: 2,
            name: 'Test setup #2',
            defaultConfigId: 2,
            generalLocation: getEnumsCollection().wpGeneralLocation[1],
        },
        {
            id: 3,
            name: 'Test setup #3',
            defaultConfigId: 3,
            generalLocation: getEnumsCollection().wpGeneralLocation[2],
        },
        {
            id: 4,
            name: 'Test setup #4',
            defaultConfigId: 4,
            generalLocation: getEnumsCollection().wpGeneralLocation[3],
        },
    ]

    constructor(protected readonly epicDbAgentSvtTestSetupConfigsService: EpicDbAgentSvtTestSetupConfigsService) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicSvtTestSetupEntity[]> {
        const result = filter?.ids
            ? this.data.filter(item => filter.ids.includes(item.id))
            : this.data

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestSetupEntity | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicSvtTestSetupCreateEntity): Observable<EpicSvtTestSetupEntity> {
        const setupId = (this.data[this.data.length - 1]?.id || 0) + 1
        return this.epicDbAgentSvtTestSetupConfigsService.create({
            setupId,
            ...createRequest.defaultConfig,
        })
            .pipe(
                map((testSetupConfig) => {
                    const newSvtTestSetup: EpicSvtTestSetupEntity = {
                        id: setupId,
                        name: createRequest.name,
                        generalLocation: createRequest.generalLocation,
                        defaultConfigId: testSetupConfig.id,
                    }

                    this.data.push(newSvtTestSetup)

                    return newSvtTestSetup
                }),
            )
    }

    update(svtTestSetupId: number, updateRequest: Partial<Omit<EpicSvtTestSetupEntity, 'id'>>): Observable<EpicSvtTestSetupEntity | null> {
        let refSvtTestSetup: EpicSvtTestSetupEntity = null

        this.data = this.data
            .map(item => {
                if (item.id === svtTestSetupId) {
                    refSvtTestSetup = {
                        ...item,
                        ...updateRequest,
                    }
                    return refSvtTestSetup
                }
                return item
            })

        return of(refSvtTestSetup)
            .pipe(
                delay(50),
            )
    }

}
