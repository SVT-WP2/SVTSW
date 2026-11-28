import { Transform } from 'class-transformer'


/**
 * `@Transform` that keeps the value of a body member exactly as the JSON had it. The global `ValidationPipe`
 * converts values to the declared type (`enableImplicitConversion`): without this, `"false"` would become the
 * boolean `true` and a number a string, and the validator would accept them. With it, `@IsBoolean()` and
 * `@IsString()` see what the client sent.
 */
export function TransformKeepPlainValue(): PropertyDecorator {
    return Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key])
}
