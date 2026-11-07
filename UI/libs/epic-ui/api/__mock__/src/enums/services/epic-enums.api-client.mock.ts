import { Injectable } from '@angular/core'
import { EpicEnumsCollection } from 'epic-api-types'
import { EpicEnumsApiClient } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'

import { EpicEnumsMock } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicEnumsApiClientMock extends EpicEnumsApiClient {

    override fetchAll(): Observable<EpicEnumsCollection> {
        return of(EpicEnumsMock.getEnumsCollection())
            .pipe(
                delay(100),
            )
    }

}
