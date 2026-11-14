import { Injectable } from '@nestjs/common'
import { intersection } from 'lodash-es'
import { delay, map, Observable, of } from 'rxjs'
import { EpicSvtTestType, EpicSvtTestTypeCreateRequest, EpicSvtTestTypesListQuery } from 'svt-ts-types'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentSvtTestTypeConfigsService } from './epic-db-agent-svt-test-type-configs.service'


@Injectable()
export class EpicDbAgentSvtTestTypesService {

    protected data: EpicSvtTestType[] = [
        {
            id: 1,
            name: 'Test type #1',
            dutTypes: [getEnumsCollection().dutType[0]],
        },
        {
            id: 2,
            name: 'Test type #2',
            dutTypes: [getEnumsCollection().dutType[0], getEnumsCollection().dutType[1]],
        },
        {
            id: 3,
            name: 'Test type #3',
            dutTypes: [getEnumsCollection().dutType[0], getEnumsCollection().dutType[1]],
        },
        {
            id: 4,
            name: 'Test type #4',
            dutTypes: [getEnumsCollection().dutType[1]],
        },
    ]

    constructor(protected readonly epicDbAgentSvtTestTypeConfigsService: EpicDbAgentSvtTestTypeConfigsService) {
    }

    getAll(queryFilter?: EpicSvtTestTypesListQuery): Observable<EpicSvtTestType[]> {
        const result = this.data
            .filter(item =>
                (!queryFilter?.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter?.dutTypes || intersection(item.dutTypes, queryFilter.dutTypes).length),
            )

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestType | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicSvtTestTypeCreateRequest): Observable<EpicSvtTestType> {
        const typeId = (this.data[this.data.length - 1]?.id || 0) + 1
        return this.epicDbAgentSvtTestTypeConfigsService.create({
            testTypeId: typeId,
            ...createRequest.testTypeConfig,
        })
            .pipe(
                map(() => {
                    const newSvtTestType: EpicSvtTestType = {
                        id: typeId,
                        name: createRequest.name,
                        dutTypes: createRequest.dutTypes,
                    }

                    this.data.push(newSvtTestType)

                    return newSvtTestType
                }),
            )
    }

    update(svtTestTypeId: number, updateRequest: Partial<Omit<EpicSvtTestType, 'id'>>): Observable<EpicSvtTestType | null> {
        let refSvtTestType: EpicSvtTestType = null

        this.data = this.data
            .map(item => {
                if (item.id === svtTestTypeId) {
                    refSvtTestType = {
                        ...item,
                        ...updateRequest,
                    }
                    return refSvtTestType
                }
                return item
            })

        return of(refSvtTestType)
            .pipe(
                delay(50),
            )
    }

}


