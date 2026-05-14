import { Observable, of, tap } from 'rxjs'


export abstract class BaseEntitiesListCachedFacade<T> {

    protected cache: T[] | undefined

    resetCache(): void {
        this.cache = undefined
    }

    fetchAll(force?: boolean): Observable<T[]> {
        if (!force && this.cache) {
            return of([...this.cache])
        }

        return this.fetchEntitiesList(force)
            .pipe(
                tap((data) => this.cache = data),
            )
    }

    protected abstract fetchEntitiesList(force?: boolean): Observable<T[]>

}
