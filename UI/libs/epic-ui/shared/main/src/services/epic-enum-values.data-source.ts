import { inject, Injectable } from '@angular/core'
import { EpicEnumName } from 'epic-ui/api'
import { SimpleDataSource } from 'epic-ui/utils'
import { map, Observable } from 'rxjs'

import { EpicEnumsFacade } from './epic-enums.facade'


export type EpicEnumValuesDsFilter = {
    enumName: EpicEnumName
}

@Injectable({ providedIn: 'root' })
export class EpicEnumValuesDataSource extends SimpleDataSource<string[], EpicEnumValuesDsFilter> {

    protected readonly epicEnumsFacade = inject(EpicEnumsFacade)
    
    protected override getDataObserver(filterValue: EpicEnumValuesDsFilter, force: boolean): Observable<string[]> {
        return this.epicEnumsFacade.fetchData(force)
            .pipe(
                map(collection => collection[filterValue.enumName]),
            )
    }

}
