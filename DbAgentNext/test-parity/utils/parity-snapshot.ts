import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { ParityOutcome } from './parity-client'


/** `test-parity/snapshots`: one JSON file per agent, the report, and (git-ignored) the full replies that were digested. */
export const PARITY_SNAPSHOTS_DIR = resolve(__dirname, '../snapshots')

/** A reply list longer than this is stored as a digest (count, hash, first and last item) and in full under `snapshots/full/`. */
export const PARITY_DIGEST_ABOVE = 200

export type ParityItemsDigest = {
    digest: true
    count: number
    sha256: string
    first: unknown
    last: unknown
}

export type ParityRecordedCase = {
    id: string
    request: { value: string; headers: Record<string, string> }
    outcome: ParityOutcome
    durationMs: number
    /** Set when `data.items` was replaced by a {@link ParityItemsDigest}. */
    digested?: boolean
    /** Set when the agent answered nothing and the recorder had to wait for it to serve again. */
    recoveredAfterMs?: number
}

export type ParitySnapshot = {
    agent: string
    recordedAt: string
    brokers: string[]
    cases: Record<string, ParityRecordedCase>
    heartbeat?: unknown
}

export function snapshotPath(agent: string): string {
    return join(PARITY_SNAPSHOTS_DIR, `${agent}.json`)
}

export function writeSnapshot(snapshot: ParitySnapshot): string {
    const path = snapshotPath(snapshot.agent)
    writeJson(path, snapshot)
    return path
}

export function readSnapshot(agent: string): ParitySnapshot {
    const path = snapshotPath(agent)
    if (!existsSync(path)) {
        throw new Error(`No recording for agent "${agent}" at ${path}: run the record spec with SVT_DB_AGENT_PARITY_AGENT=${agent} first`)
    }
    return JSON.parse(readFileSync(path, 'utf8')) as ParitySnapshot
}

export function writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/**
 * Keeps the snapshot small: a long `data.items` list becomes a digest over the canonical form of the items
 * (keys sorted, items ordered by `id` when every item has one), and the full reply goes to `snapshots/full/`.
 */
export type ParityDigestResult = {
    outcome: ParityOutcome
    digested: boolean
}

export function digestLongLists(agent: string, caseId: string, outcome: ParityOutcome): ParityDigestResult {
    if (outcome.kind !== 'reply' || 'raw' in outcome.value) {
        return { outcome, digested: false }
    }
    const data = outcome.value.data
    if (!isRecord(data) || !Array.isArray(data['items']) || data['items'].length <= PARITY_DIGEST_ABOVE) {
        return { outcome, digested: false }
    }
    writeJson(join(PARITY_SNAPSHOTS_DIR, 'full', agent, `${caseId.replace(/[^\w.-]+/g, '_')}.json`), outcome)
    const items = sortItems(data['items'])
    const digest: ParityItemsDigest = {
        digest: true,
        count: items.length,
        sha256: createHash('sha256').update(JSON.stringify(items.map((item) => canonical(item)))).digest('hex'),
        first: items[0],
        last: items[items.length - 1],
    }
    return {
        outcome: { ...outcome, value: { ...outcome.value, data: { ...data, items: digest } } },
        digested: true,
    }
}

/** A JSON value with every object's keys sorted, so two values compare as strings regardless of key order. */
export function canonical(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => canonical(item))
    }
    if (isRecord(value)) {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    }
    return value
}

/** Items ordered by `id` when every item has a numeric one, otherwise by their canonical JSON text. */
export function sortItems(items: unknown[]): unknown[] {
    const byId = items.every((item) => isRecord(item) && typeof item['id'] === 'number')
    return [...items].sort((left, right) => {
        if (byId) {
            return ((left as { id: number }).id) - ((right as { id: number }).id)
        }
        return JSON.stringify(canonical(left)).localeCompare(JSON.stringify(canonical(right)))
    })
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
