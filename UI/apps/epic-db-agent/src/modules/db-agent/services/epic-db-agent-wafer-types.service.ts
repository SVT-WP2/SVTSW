import { Injectable } from '@nestjs/common'
import { EpicWaferTypeCreateEntity, EpicWaferTypeCreateRequestDto, EpicWaferTypeEntity, EpicWaferTypeMapEntity } from 'epic/entities'
import { omit } from 'lodash-es'
import { delay, map, Observable, of } from 'rxjs'


@Injectable()
export class EpicDbAgentWaferTypesService {

    protected waferTypes: EpicWaferTypeEntity[] = [
        {
            id: 1,
            name: 'ER1',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 2,
            name: 'ER1 - Map@1.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 3,
            name: 'ER1 - Map@2.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 4,
            name: 'ER1 - Map@2.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
    ]

    protected waferTypeMaps: {[waferTypeId: number]: string | null } = {}

    getAll(filter?: { waferIds?: number[] }): Observable<EpicWaferTypeEntity[]> {
        const result = filter?.waferIds
            ? this.waferTypes.filter(item => filter.waferIds.includes(item.id))
            : this.waferTypes

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(waferTypeId: number): Observable<EpicWaferTypeEntity | undefined> {
        return this.getAll()
            .pipe(
                map(list => list.find(item => item.id === waferTypeId)),
            )
    }

    create(createRequest: EpicWaferTypeCreateEntity): Observable<EpicWaferTypeEntity> {
        const newWafer = {
            id: (this.waferTypes[this.waferTypes.length - 1]?.id || 0) + 1,
            ...omit(createRequest, 'waferMap' satisfies keyof EpicWaferTypeCreateRequestDto),
        }

        this.waferTypes.push(newWafer)
        this.waferTypeMaps[newWafer.id] = createRequest.waferMap!

        return of(newWafer)
            .pipe(
                delay(50),
            )
    }

    getWaferTypeMap(waferTypeId: number): Observable<EpicWaferTypeMapEntity | undefined> {
        return this.getOneById(waferTypeId)
            .pipe(
                map(item => item
                    ? { waferMap: this.waferTypeMaps[waferTypeId] }
                    : undefined,
                ),
            )
    }

}
