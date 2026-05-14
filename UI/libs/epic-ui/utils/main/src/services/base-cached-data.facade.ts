import { cloneDeep } from 'lodash-es'
import { Observable, of, tap } from 'rxjs'


export abstract class BaseCachedDataFacade<T> {

    protected cache: T | undefined

    resetCache(): void {
        this.cache = undefined
    }

    fetchData(force?: boolean): Observable<T> {
        if (!force && this.cache) {
            return of(cloneDeep(this.cache))
        }

        return this._fetchData(force)
            .pipe(
                tap((data) => this.cache = data),
            )
    }

    protected abstract _fetchData(force?: boolean): Observable<T>

}
