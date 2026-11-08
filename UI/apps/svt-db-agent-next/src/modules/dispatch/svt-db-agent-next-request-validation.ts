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
