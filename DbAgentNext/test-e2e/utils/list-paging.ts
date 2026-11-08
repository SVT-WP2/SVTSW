import { TestSetup } from './test-setup'


/**
 * `data.pager` of a list message, checked against the rows a spec has just listed without one (`all`, in the
 * list's order): a page in the middle, a page past the end (empty, with the real `totalCount`) and an invalid
 * limit. Every list pages in the database (X-4); eleven of them ignored the pager until 2026-11-14
 * (`docs/03-parity-testing.md` §5.1).
 */
export async function expectListPaging(setup: TestSetup, type: string, all: unknown[]): Promise<void> {
    expect(all.length, 'paging needs at least two rows').toBeGreaterThanOrEqual(2)

    const page = await setup.send({ type, data: { pager: { limit: 1, offset: 1 } } })
    expect(page.status, page.error.message).toBe('Success')
    expect(page.data).toEqual({ items: [all[1]], totalCount: all.length })

    const beyond = await setup.send({ type, data: { pager: { limit: 2, offset: all.length + 3 } } })
    expect(beyond.data).toEqual({ items: [], totalCount: all.length })

    const invalid = await setup.send({ type, data: { pager: { limit: -1 } } })
    expect(invalid.status).toBe('BadRequest')
}
