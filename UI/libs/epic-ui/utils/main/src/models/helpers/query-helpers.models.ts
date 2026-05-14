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
            .reduce(
                (accHttpParams, key) => {

                    const value = (TypeHelpers.isObject(queryParams[key]))
                        ? Object.keys(queryParams[key]).length > 0 ? JSON.stringify(queryParams[key]) : null
                        : queryParams[key]


                    if (value === null || value === undefined) {
                        return accHttpParams
                    }

                    return accHttpParams.append(key, value as string)
                },
                httpParams,
            )
    }
}
