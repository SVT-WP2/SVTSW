import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTypeConfigBody, EpicSvtTestTypeConfigsApiClient } from 'epic-ui/api'
import { Observable, of, tap } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeConfigBodyDataFacade {

    protected cache: { [testTypeConfigId: number]: EpicSvtTestTypeConfigBody } = {}

    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

    fetchData(testTypeConfigId: number, force: boolean = false): Observable<EpicSvtTestTypeConfigBody> {
        if (this.cache[testTypeConfigId] && !force) {
            return of(this.cache[testTypeConfigId])
        }
        return this.epicSvtTestTypeConfigsApiClient.fetchConfigBody(testTypeConfigId)
            .pipe(
                tap((body) => this.cache[testTypeConfigId] = body),
            )
    }

    resetCache(): void {
        this.cache = {}
    }

}

