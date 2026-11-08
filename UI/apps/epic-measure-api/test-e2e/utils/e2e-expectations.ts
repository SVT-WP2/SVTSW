import { E2eResponse, TestSetup } from './test-setup'


/** NestJS's error body: `message` is a string, or the list of the `ValidationPipe`'s messages. */
export type E2eErrorBody = {
    statusCode: number
    message: string | string[]
    error?: string
}

/**
 * An error response: the status, and every given fragment somewhere in its message (the `ValidationPipe`'s list
 * joined). Agent errors arrive as `[<code>]: <agent message>` (`processKafkaReplyError`).
 */
export function expectError(response: E2eResponse, status: number, ...fragments: string[]): void {
    expect(response.status, JSON.stringify(response.body)).toBe(status)
    const body = response.body as E2eErrorBody
    expect(body.statusCode).toBe(status)
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message
    for (const fragment of fragments) {
        expect(message).toContain(fragment)
    }
}

/** A successful response: the status, with the body in the failure message for a quick diagnosis. */
export function expectStatus<T>(response: E2eResponse<T>, status: number): T {
    expect(response.status, JSON.stringify(response.body)).toBe(status)
    return response.body
}

/**
 * The paging of a page endpoint (`{ items, totalCount }`: ASICs, chips, chip blocks, SVT tests), checked against
 * the rows `all` it has just listed in its order: a page in the middle, a page past the end (empty, with the real
 * `totalCount`), a `limit` the BFF rejects (above 10 000, not a number), one the agent rejects (negative), and an
 * `offset` that is no number.
 */
export async function expectPageQueryParams(setup: TestSetup, path: string, all: unknown[]): Promise<void> {
    expect(all.length, 'paging needs at least two rows').toBeGreaterThanOrEqual(2)
    const join = path.includes('?') ? '&' : '?'

    expect(expectStatus(await setup.get(`${path}${join}limit=1&offset=1`), 200)).toEqual({ items: [all[1]], totalCount: all.length })
    expect(expectStatus(await setup.get(`${path}${join}limit=2&offset=${all.length + 3}`), 200))
        .toEqual({ items: [], totalCount: all.length })

    expectError(await setup.get(`${path}${join}limit=10001`), 400, 'limit must not be greater than 10000')
    expectError(await setup.get(`${path}${join}limit=many`), 400, 'limit must be a number')
    expectError(await setup.get(`${path}${join}limit=-1`), 400, 'limit')
    expectError(await setup.get(`${path}${join}offset=first`), 400, 'offset must be a number')
}

/** `?key=v1&key=v2…`: a list the way the UI sends it (`QueryHelpers.applyQueryParams` repeats the key). */
export function repeatedQuery(key: string, values: (string | number)[]): string {
    return values.map((value) => `${key}=${encodeURIComponent(String(value))}`).join('&')
}
