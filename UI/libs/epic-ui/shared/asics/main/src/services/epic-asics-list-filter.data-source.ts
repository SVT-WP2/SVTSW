import { inject, Injectable } from '@angular/core'
import { EpicEnumName } from 'epic-ui/api'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { EpicWafersStoreFacade } from 'epic-ui/shared/wafers'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, Observable, of } from 'rxjs'
import { map } from 'rxjs/operators'

import { EpicAsicsListFilterData } from '../models'


export type EpicAsicsListFilterDsFilter = {
    dismissWafersData?: boolean
}

@Injectable({ providedIn: 'root' })
export class EpicAsicsListFilterDataSource extends SimpleDataSource<EpicAsicsListFilterData, EpicAsicsListFilterDsFilter> {

    protected readonly epicEnumsFacade = inject(EpicEnumsFacade)
    protected readonly epicWafersStoreFacade = inject(EpicWafersStoreFacade)

    protected override getDataObserver(filterValue: EpicAsicsListFilterDsFilter, force: boolean): Observable<EpicAsicsListFilterData> {
        return forkJoin({
            enumsCollection: this.epicEnumsFacade.fetchData(force),
            wafersList: filterValue?.dismissWafersData ? of([]) : this.epicWafersStoreFacade.fetchAll$(),
        })
            .pipe(
                map(({ enumsCollection, wafersList }) => ({
                    asicFamilyTypeSelectOptions: enumsCollection[EpicEnumName.asicFamilyType]
                        .map(item => ({ value: item, label: item })),
                    asicQualitySelectOptions: enumsCollection[EpicEnumName.asicQuality]
                        .map(item => ({ value: item, label: item })),
                    waferSelectOptions: wafersList.map(item => ({ value: item.id, label: item.serialNumber, additionalData: item })),
                })),
            )
    }

}
