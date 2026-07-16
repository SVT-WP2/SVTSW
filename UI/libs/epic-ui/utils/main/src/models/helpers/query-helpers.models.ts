import { HttpParams } from '@angular/common/http'

import { TypeHelpers } from '../helpers'


export namespace QueryHelpers {

    export function applyQueryParams<TQueryParams extends Record<string, unknown> = Record<string, unknown>>(
        queryParams: TQueryParams, httpParams: HttpParams = new HttpParams()): HttpParams {
        const isNotEmptyFilter = Object.keys(queryParams).length > 0

        if (!isNotEmptyFilter) {
            return httpParams
        }

        return Object.keys(queryParams)
            .reduce<HttpParams>(
                (accHttpParams, key) => {
                    const raw = queryParams[key]

                    if (raw === null || raw === undefined) {
                        return accHttpParams
                    }

                    if (TypeHelpers.isArray(raw)) {
                        if ((raw as unknown[]).length === 0) {
                            return accHttpParams
                        }
                        return (raw as unknown[]).reduce<HttpParams>(
                            (acc, item) => acc.append(key, item as string),
                            accHttpParams,
                        )
                    }

                    const value = TypeHelpers.isObject(raw)
                        ? Object.keys(raw).length > 0 ? JSON.stringify(raw) : null
                        : raw

                    if (value === null || value === undefined) {
                        return accHttpParams
                    }

                    return accHttpParams.append(key, value as string)
                },
                httpParams,
            )
    }
}
