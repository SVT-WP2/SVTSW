import { inject, Injectable } from '@angular/core'
import { EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigsApiClient } from 'epic-ui/api'
import { Observable, of, tap } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigsDataFacade {

    protected cache: { [testSetupConfigId: number]: EpicSvtTestSetupConfigBody } = {}

    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)

    fetchData(testSetupConfigId: number, force: boolean = false): Observable<EpicSvtTestSetupConfigBody> {
        if (this.cache[testSetupConfigId] && !force) {
            return of(this.cache[testSetupConfigId])
        }
        return this.epicSvtTestSetupConfigsApiClient.fetchConfigBody(testSetupConfigId)
            .pipe(
                tap((body) => this.cache[testSetupConfigId] = body),
            )
    }

    resetCache(): void {
        this.cache = {}
    }

}
