import { inject, Injectable } from '@angular/core'
import { EpicEnumName } from 'epic-ui/api'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { EpicChipsListFilterData } from '../components'


@Injectable({ providedIn: 'root' })
export class EpicChipsListFilterDataSource extends SimpleDataSource<EpicChipsListFilterData> {

    protected readonly epicEnumsFacade = inject(EpicEnumsFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicChipsListFilterData> {
        return this.epicEnumsFacade.fetchData(force)
            .pipe(
                map((enumsCollection) => ({
                    familyTypeSelectOptions: enumsCollection[EpicEnumName.asicFamilyType]
                        .map(item => ({ value: item, label: item })),
                    generalLocationSelectOptions: enumsCollection[EpicEnumName.wpGeneralLocation]
                        .map(item => ({ value: item, label: item })),
                })),
            )
    }

}
