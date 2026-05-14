import { TypeHelpers } from './type.helpers'


export namespace StringHelpers {

    export function camelCaseToDashCase(str: string): string {
        const val = str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        return val
    }

    export function camelCaseToSnackCase(str: string, makeUppercase: boolean = false): string {
        const snackCaseStr = str.replace(/([a-z])([A-Z])/g, '$1_$2')
        return makeUppercase
            ? snackCaseStr.toUpperCase()
            : snackCaseStr.toLowerCase()
    }

    /**
     * Generate unique string ID
     */
    export function guid(): string {
        return window.crypto.randomUUID()
    }

    export function snakeCaseToCamelCase(str: string, firstCharterUpper = true): string {
        const regex = new RegExp('([-_][a-z])', 'ig')
        return str.toLowerCase().replace(regex, ($1) => {
            return (firstCharterUpper ? $1.toUpperCase() : $1.toLowerCase())
                .replace('-', '')
                .replace('_', '')
        })
    }

    export function numberToString(num: number, minLength = 2): string {
        let resString = num.toString()

        while (resString.length < minLength) {
            resString = '0' + resString
        }

        return resString
    }

    export function firstLowerCase(str: string): string {
        return str[0].toLowerCase() + str.slice(1)
    }

    export function firstUpperCase(str: string): string {
        return str[0].toUpperCase() + str.slice(1)
    }

    export function toStringValue(value: number | Array<unknown> | Record<string, unknown>): string {
        if (TypeHelpers.isString(value)) {
            return value
        }
        else if (TypeHelpers.isNumber(value) || TypeHelpers.isBoolean(value)) {
            return value.toString()
        }
        else if (TypeHelpers.isArray(value)) {
            return value.join(', ')
        }
        else if (TypeHelpers.isObject(value)) {
            return JSON.stringify(value)
        }
        else {
            return ''
        }
    }

    export function encodeObjToUrlString(obj: Record<string, any>): string {
        return encodeBase64(JSON.stringify(obj))
    }

    export function decodeObjFromUrlString<T extends Record<string, any> = Record<string, any>>(str: string): T {
        return JSON.parse(decodeBase64(str)) as T
    }

    export function encodeBase64(str: string): string {
        return window.btoa(str)
    }

    export function decodeBase64(str: string): string {
        const decodedStr = decodeURIComponent(str)
        return window.atob(decodedStr)
    }

    export function toSingleLine(str: string, replaceStr = ' '): string | undefined {
        return str?.replace(/(\r\n|\t|\r|\n)/g, replaceStr)
    }

    export function replaceAllQualifiers(
        originalString: string,
        qualifiersList: string[],
        replaceQualifier: (origin: string, qualifier: string) => string,
    ): string {
        return Object.values(qualifiersList)
            .reduce(
                (acc, valueFunctionName) => {
                    let result = replaceQualifier(acc, valueFunctionName)
                    let nextResult = replaceQualifier(result, valueFunctionName)
                    while (result !== nextResult) {
                        result = nextResult
                        nextResult = replaceQualifier(result, valueFunctionName)
                    }
                    return result
                },
                originalString,
            )
    }

}
