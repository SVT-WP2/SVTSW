import { Transform } from 'class-transformer'


/**
 * A query-string array member as the UI sends it (`QueryHelpers.applyQueryParams` appends the key once per
 * item): one item arrives as a plain string, several as an array, and a Swagger user may type `a,b` or `k[]=a`.
 * The `ValidationPipe`'s implicit conversion may already have wrapped a single value in an array. Absent and
 * `null` both come out as `undefined` (the member stays optional); empty tokens are dropped.
 */
export function toQueryStringArray(value: unknown): string[] | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    return (Array.isArray(value) ? value : [value])
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter((item) => item !== '')
}

/** {@link toQueryStringArray}, each token as a number (`NaN` for a token that is none, for the validator to reject). */
export function toQueryNumberArray(value: unknown): number[] | undefined {
    return toQueryStringArray(value)?.map((token) => Number(token))
}

/** `@Transform` for a `string[]` query member; put it next to `@IsArray()` / `@IsString({ each: true })`. */
export function TransformQueryStringArray(): PropertyDecorator {
    return Transform(({ value }: { value: unknown }) => toQueryStringArray(value))
}

/** `@Transform` for a `number[]` query member; put it next to `@IsInt({ each: true })`. */
export function TransformQueryNumberArray(): PropertyDecorator {
    return Transform(({ value }: { value: unknown }) => toQueryNumberArray(value))
}
