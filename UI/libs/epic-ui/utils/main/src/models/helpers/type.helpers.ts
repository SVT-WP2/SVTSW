import { isObservable, Observable, of } from 'rxjs'


export namespace TypeHelpers {

    export function isBoolean(value: any): value is boolean {
        return typeof value === 'boolean'
    }

    export function isArray(value: any): value is Array<any> {
        return Array.isArray(value)
    }

    export function isFunction(value: any): value is (...args: any) => any {
        return typeof value === 'function'
    }

    export function isNumber(value: any): value is number {
        return typeof value === 'number'
    }

    export function isObject(value: any): value is Record<string, any> {
        if (value === null) {
            return false
        }
        return typeof value === 'object' && Object.prototype.toString.call(value) !== '[object Array]'
    }

    export function isString(value: any): value is string {
        return typeof value === 'string'
    }

    export function isEmpty(value: any): boolean {
        if (TypeHelpers.isArray(value)) {
            return value.length === 0
        }
        else if (TypeHelpers.isObject(value)) {
            return Object.keys(value).length === 0
        }
        else {
            return value === undefined || value === null
        }
    }

    export function toObservable<T>(value: T | Observable<T>): Observable<T> {
        return isObservable(value) ? value : of(value)
    }

}
