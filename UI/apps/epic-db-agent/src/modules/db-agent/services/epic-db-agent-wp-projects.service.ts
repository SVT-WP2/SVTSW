import { Injectable } from '@nestjs/common'
import { EpicWpProjectCreateDto } from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'
import { EpicWpProject } from 'svt-ts-types'


@Injectable()
export class EpicDbAgentWpProjectsService {

    protected entities: EpicWpProject[] = [
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

    getAll(filter?: { ids?: number[] }): Observable<EpicWpProject[]> {
        const result = filter?.ids
            ? this.entities.filter(item => filter.ids.includes(item.id))
            : [...this.entities]
        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(waferId: number): Observable<EpicWpProject | undefined> {
        return this.getAll()
            .pipe(
                map(list => list.find(item => item.id === waferId)),
            )
    }

    create(createRequest: EpicWpProjectCreateDto): Observable<EpicWpProject> {
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
