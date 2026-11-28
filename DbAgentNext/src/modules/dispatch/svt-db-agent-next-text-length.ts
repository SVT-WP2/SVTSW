import { ValidateBy, ValidationOptions } from 'class-validator'


/**
 * The length of a text as PostgreSQL counts it in a `varchar(n)` column of a UTF-8 database: Unicode code points.
 * class-validator's `@Length` counts otherwise: it does not count U+FE0F and U+FE0E, so a text that `@Length`
 * accepts can be too long for its column.
 */
export function textLength(text: string): number {
    return [...text].length
}

/** The reply text of a length check: `<path> must be <min> to <max> characters long`. */
export function textLengthMessage(path: string, min: number, max: number): string {
    return `${path} must be ${min} to ${max} characters long`
}

/** A string of `min` to `max` characters, counted by {@link textLength}. */
export function HasTextLength(min: number, max: number, options?: ValidationOptions): PropertyDecorator {
    return ValidateBy({
        name: 'hasTextLength',
        constraints: [min, max],
        validator: {
            validate: (value: unknown) => typeof value === 'string' && textLength(value) >= min && textLength(value) <= max,
            defaultMessage: (args) => textLengthMessage(args?.property ?? 'value', min, max),
        },
    }, options)
}
