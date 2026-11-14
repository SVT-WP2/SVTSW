import { Injectable } from '@angular/core'
import { EpicEnumsApiClient } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'
import { EpicEnumsCollection } from 'svt-ts-types'

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
