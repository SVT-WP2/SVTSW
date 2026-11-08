import { ParityCase } from './parity-cases'
import { ParityOutcome } from './parity-client'
import { findKnownDifference } from './parity-known-differences'
import { canonical, isRecord, ParityRecordedCase, sortItems } from './parity-snapshot'


/** The C++ prefixes every error message with its source location: `[/app/app/src/X.cpp:482]\n` (R-9). */
const CPP_SOURCE_LOCATION = /^\[[^\]\n]*:\d+\]\n/

export type ParityVerdict = 'same' | 'intentional' | 'different' | 'missing'

export type ParityComparison = {
    id: string
    verdict: ParityVerdict
    /** The decision id for an intentional difference. */
    decision?: string
    /** Where the two normalised replies differ, as `path: left ≠ right` lines (at most a few). */
    details: string[]
    left?: ParityRecordedCase
    right?: ParityRecordedCase
}

/**
 * The comparable form of one recorded outcome (`03-parity-testing.md` §3): status, type and error code as
 * they are; the error message without the C++ source location; `data` with keys sorted, `items` as a set where
 * the order is not defined, and the volatile keys blanked.
 */
export function normalise(parityCase: ParityCase | undefined, outcome: ParityOutcome): unknown {
    if (outcome.kind === 'timeout') {
        return { kind: 'timeout' }
    }
    if ('raw' in outcome.value) {
        return { kind: 'raw', raw: outcome.value.raw }
    }
    const { type, status, data, error } = outcome.value
    let comparableData: unknown = data
    if (parityCase?.items === 'set' && isRecord(data) && Array.isArray(data['items'])) {
        comparableData = { ...data, items: sortItems(data['items']) }
    }
    return canonical({
        kind: 'reply',
        type,
        status,
        error: { code: error?.code, message: (error?.message ?? '').replace(CPP_SOURCE_LOCATION, '') },
        data: blankVolatile(comparableData, parityCase?.volatileKeys ?? []),
    })
}

export function compareCase(
    id: string,
    parityCase: ParityCase | undefined,
    left?: ParityRecordedCase,
    right?: ParityRecordedCase,
): ParityComparison {
    if (!left || !right) {
        return { id, verdict: 'missing', details: [`recorded for ${left ? 'the left' : 'the right'} agent only`], left, right }
    }
    const normalisedLeft = normalise(parityCase, left.outcome)
    const normalisedRight = normalise(parityCase, right.outcome)
    const details = diffPaths(normalisedLeft, normalisedRight)
    if (!details.length) {
        return { id, verdict: 'same', details, left, right }
    }
    const known = findKnownDifference(id)
    return known
        ? { id, verdict: 'intentional', decision: known.decision, details, left, right }
        : { id, verdict: 'different', details, left, right }
}

/** Up to `limit` paths where two canonical values differ, each with both sides shortened for the report. */
export function diffPaths(left: unknown, right: unknown, limit = 8): string[] {
    const paths: string[] = []
    const walk = (leftValue: unknown, rightValue: unknown, path: string): void => {
        if (paths.length >= limit) {
            return
        }
        if (isRecord(leftValue) && isRecord(rightValue)) {
            for (const key of new Set([...Object.keys(leftValue), ...Object.keys(rightValue)])) {
                walk(leftValue[key], rightValue[key], path ? `${path}.${key}` : key)
            }
            return
        }
        if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
            if (leftValue.length !== rightValue.length) {
                paths.push(`${path}.length: ${leftValue.length} ≠ ${rightValue.length}`)
            }
            for (let index = 0; index < Math.min(leftValue.length, rightValue.length); index++) {
                walk(leftValue[index], rightValue[index], `${path}[${index}]`)
            }
            return
        }
        if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
            paths.push(`${path || '(root)'}: ${shorten(leftValue)} ≠ ${shorten(rightValue)}`)
        }
    }
    walk(left, right, '')
    return paths
}

function blankVolatile(value: unknown, keys: string[]): unknown {
    if (!keys.length) {
        return value
    }
    if (Array.isArray(value)) {
        return value.map((item) => blankVolatile(item, keys))
    }
    if (isRecord(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) =>
            [key, keys.includes(key) ? '<volatile>' : blankVolatile(item, keys)]))
    }
    return value
}

export function shorten(value: unknown, max = 160): string {
    const text = value === undefined ? 'undefined' : JSON.stringify(value)
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
