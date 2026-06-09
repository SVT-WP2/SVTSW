import { ActivatedRoute, NavigationExtras, Params, Router, UrlTree } from '@angular/router'
import { omit } from 'lodash-es'


export namespace RouterHelpers {

    export function updateCurrentRouterQueryParams(router: Router,
                                                   activatedRoute: ActivatedRoute,
                                                   queryParams: Params,
                                                   replaceUrl: boolean = true): void {

        const extras: NavigationExtras = {
            queryParams,
            relativeTo: activatedRoute,
            replaceUrl,
        }

        void router.navigate([], extras)
    }

    export function setQueryParam(queryParams: Params, paramName: string, value: string | null): Params {
        return value
            ? {
                ...queryParams,
                [paramName]: value,
            }
            : omit(queryParams, paramName)
    }

    export function setQueryParamsList(queryParams: Params, paramsValues: Record<string, string | null>): Params {
        return Object.keys(paramsValues)
            .reduce(
                (acc, key) => setQueryParam(acc, key, paramsValues[key]),
                queryParams,
            )
    }

    export function updateCurrentRouterOneQueryParam(router: Router,
                                                     activatedRoute: ActivatedRoute,
                                                     paramName: string,
                                                     value: string | null,
                                                     replaceUrl: boolean = true): void {

        const queryParams = setQueryParam(activatedRoute.snapshot.queryParams, paramName, value)
        updateCurrentRouterQueryParams(router, activatedRoute, queryParams, replaceUrl)
    }

    export function extractQueryParams(url: string): Params {
        if ((url || '').split('?').length !== 2) {
            return { }
        }

        return url.split('?')[1].split('&')
            .reduce(
                (acc, currentValue) => {
                    const [key, value] = currentValue.split('=')
                    return ({ ...acc, ...{ [key]: value } })
                },
                {},
            )
    }

    export function extractBaseUrl(url?: string): string {
        return (url || '').split('?')[0]
    }

    export function toUrlTree(url: string, router: Router): UrlTree {
        const baseUrl = extractBaseUrl(url)
        const queryParams = extractQueryParams(url)

        return router.createUrlTree(
            [baseUrl],
            { queryParams },
        )
    }

}
