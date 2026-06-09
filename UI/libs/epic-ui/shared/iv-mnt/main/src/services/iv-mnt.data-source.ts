import { inject, Injectable } from '@angular/core'
import { EpicIvMnt, EpicIvMntApiClient } from 'epic-ui/api'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable()
export class IvMntDataSource extends SimpleDataSource<EpicIvMnt[]> {

    // DI
    protected readonly epicIvMntApiClient = inject(EpicIvMntApiClient)

    protected getDataObserver(filterValue: Record<string, any>, force: boolean): Observable<EpicIvMnt[]> {
        return this.epicIvMntApiClient.fetchList()
    }

}
