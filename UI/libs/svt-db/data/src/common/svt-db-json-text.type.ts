import { Type } from '@mikro-orm/core'


/**
 * A `json` column handled as **text**: the string is written as is (PostgreSQL validates it and, unlike
 * `jsonb`, keeps the exact text) and read back with `::text`, so what a client stored is what it gets,
 * whitespace and key order included. For the config files of test setups and test types, which humans
 * edit in the UI; machine-generated JSON (wafer maps, specifications) uses MikroORM's `json` type instead.
 *
 * Callers validate the text with `JSON.parse` first: an invalid document would otherwise fail inside
 * PostgreSQL as an unexpected error.
 */
export class SvtDbJsonTextType extends Type<string, string> {

    override convertToDatabaseValue(value: string): string {
        return value
    }

    override convertToJSValue(value: unknown): string {
        return typeof value === 'string' ? value : JSON.stringify(value)
    }

    override convertToJSValueSQL(key: string): string {
        return `${key}::text`
    }

    override getColumnType(): string {
        return 'json'
    }

    override compareAsType(): string {
        return 'string'
    }

}
