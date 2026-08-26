import { inject, Injectable } from '@angular/core'
import { EpicEnumName } from 'epic-ui/api'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { EpicChipBlocksListFilterData } from '../components'


@Injectable({ providedIn: 'root' })
export class EpicChipBlocksListFilterDataSource extends SimpleDataSource<EpicChipBlocksListFilterData> {

    protected readonly epicEnumsFacade = inject(EpicEnumsFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicChipBlocksListFilterData> {
        return this.epicEnumsFacade.fetchData(force)
            .pipe(
                map((enumsCollection) => ({
                    chipBlockTypeSelectOptions: enumsCollection[EpicEnumName.blockType]
                        .map(item => ({ value: item, label: item })),
                })),
            )
    }

}
