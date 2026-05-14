import { Injectable } from '@nestjs/common'
import { EpicWpProjectCreateDto, EpicWpProjectEntity } from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'


@Injectable()
export class EpicDbAgentWpProjectsService {

    protected entities: EpicWpProjectEntity[] = [
        {
            id: 1,
            wpMachineId: 1,
            waferTypeId: 1,
            name: 'Project #1',
            asicFamilyType: 'BABYMOSS',
            orientation: 'North',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
        {
            id: 2,
            wpMachineId: 1,
            waferTypeId: 1,
            name: 'Project #2',
            asicFamilyType: 'BABYMOSS',
            orientation: 'South',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
        {
            id: 3,
            wpMachineId: 2,
            waferTypeId: 1,
            name: 'Project #1',
            asicFamilyType: 'BABYMOSS',
            orientation: 'South',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
    ]

    getAll(filter?: { ids?: number[] }): Observable<EpicWpProjectEntity[]> {
        const result = filter?.ids
            ? this.entities.filter(item => filter.ids.includes(item.id))
            : [...this.entities]
        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(waferId: number): Observable<EpicWpProjectEntity | undefined> {
        return this.getAll()
            .pipe(
                map(list => list.find(item => item.id === waferId)),
            )
    }

    create(createRequest: EpicWpProjectCreateDto): Observable<EpicWpProjectEntity> {
        const newWpProject = {
            id: (this.entities[this.entities.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.entities.push(newWpProject)

        return of(newWpProject)
            .pipe(
                delay(50),
            )
    }

}
