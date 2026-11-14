import { Type } from '@mikro-orm/core'


/**
 * A PostgreSQL `json` column read and written as its text. A `json` value keeps the text it was written with,
 * and `::text` returns that text unchanged; MikroORM's own `json` type parses the value and writes
 * `JSON.stringify` back, which drops the client's formatting. The Kafka contract returns these fields byte for
 * byte (R-7), and the C++ agent returned the stored text, so they stay strings end to end.
 *
 * The caller checks that a string it writes is valid JSON; PostgreSQL rejects one that is not.
 */
export class SvtDbJsonTextType extends Type<string | null, string | null> {

    override convertToDatabaseValue(value: string | null): string | null {
        return value
    }

    /** The text of the `::text` select below; a parsed value (a select that bypassed it) is serialised again. */
    override convertToJSValue(value: unknown): string | null {
        if (value === null || value === undefined) {
            return null
        }
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
