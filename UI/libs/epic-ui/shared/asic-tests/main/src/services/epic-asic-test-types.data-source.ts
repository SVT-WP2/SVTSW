import { inject, Injectable } from '@angular/core'
import { EpicAsicTestType } from 'epic-ui/api'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicAsicTestTypesFacade } from './epic-asic-test-types.facade'


@Injectable({ providedIn: 'root' })
export class EpicAsicTestTypesDataSource extends SimpleDataSource<EpicAsicTestType[]> {

    protected readonly epicAsicTestTypesFacade = inject(EpicAsicTestTypesFacade)

    protected override getDataObserver(filterValue: Record<string, any>, force: boolean): Observable<EpicAsicTestType[]> {
        return this.epicAsicTestTypesFacade.fetchAll(force)
    }

}
