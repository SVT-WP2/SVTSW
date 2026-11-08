import { ClassConstructor, plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'

import { SvtDbAgentNextRequestError } from './svt-db-agent-next-request-error'


export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `data` (or a nested key) must be a JSON object. */
export function requireRecord(value: unknown, path: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be an object`)
    }
    return value
}

/** `data` may be absent; when present it must be a JSON object. */
export function optionalRecord(value: unknown, path: string): Record<string, unknown> {
    return value === undefined || value === null ? {} : requireRecord(value, path)
}

export function requireInteger(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be an integer`)
    }
    return value
}

export function optionalInteger(value: unknown, path: string): number | undefined {
    return value === undefined || value === null ? undefined : requireInteger(value, path)
}

export function optionalString(value: unknown, path: string): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (typeof value !== 'string') {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be a string`)
    }
    return value
}

/**
 * A `filter` object may only carry the keys the contract declares for that list; the message text is the
 * C++ agent's (`04-request-engine.md` §8), kept for parity.
 */
export function requireAllowedFilterKeys(filter: Record<string, unknown>, allowed: readonly string[]): void {
    for (const key of Object.keys(filter)) {
        if (!allowed.includes(key)) {
            throw SvtDbAgentNextRequestError.badRequest(`Error: ${key} is not an allowed filter.`)
        }
    }
}

export function optionalIntegerList(value: unknown, path: string): number[] | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'number' && Number.isInteger(item))) {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be a list of integers`)
    }
    return value as number[]
}

export function optionalStringList(value: unknown, path: string): string[] | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be a list of strings`)
    }
    return value
}

/**
 * Validates a request body against a decorated DTO class (the contract DTOs of `epic/entities`): every
 * declared field by its own rules, unknown keys rejected (`01-behaviour-decisions.md` §1). Throws
 * `BadRequest` listing every violation.
 */
export function validateRequestData<T extends object>(dtoClass: ClassConstructor<T>, value: unknown, path: string): T {
    const instance = plainToInstance(dtoClass, requireRecord(value, path))
    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false })
    if (errors.length > 0) {
        throw SvtDbAgentNextRequestError.badRequest(`${path}: ${errors.flatMap(formatValidationError).join('; ')}`)
    }
    return instance
}

function formatValidationError(error: ValidationError): string[] {
    const own = Object.values(error.constraints ?? {})
    const nested = (error.children ?? []).flatMap(formatValidationError)
    return [...own, ...nested]
}

/**
 * A JSON document sent as a string (R-7: JSON travels as text on the wire). Returns the parsed value;
 * throws `BadRequest` when the text is not valid JSON. Callers that store the text itself ignore the result.
 */
export function parseJsonOrBadRequest(text: string, path: string): unknown {
    try {
        return JSON.parse(text)
    }
    catch {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be a string holding valid JSON`)
    }
}

/** An optional ISO 8601 date-time (e.g. a filter bound) as a `Date`; `null` and absent mean "not given". */
export function optionalDateTime(value: unknown, path: string): Date | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    const date = typeof value === 'string' && value.trim() !== '' ? new Date(value) : new Date(NaN)
    if (Number.isNaN(date.getTime())) {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be an ISO 8601 date-time`)
    }
    return date
}
