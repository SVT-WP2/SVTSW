import { inject, Injectable } from '@angular/core'
import { EpicUsersApiClient } from 'epic-ui/api'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicUser } from 'svt-ts-types'


/** The users of the users page (pattern A): no store, one grid. */
@Injectable({ providedIn: 'root' })
export class EpicUsersGridDataSource extends SimpleDataSource<EpicUser[]> {

    protected readonly usersApiClient = inject(EpicUsersApiClient)

    protected override getDataObserver(): Observable<EpicUser[]> {
        return this.usersApiClient.fetchList()
    }

}
