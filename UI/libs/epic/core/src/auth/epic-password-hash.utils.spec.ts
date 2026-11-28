// @vitest-environment node
import { EpicPasswordHash, hashEpicPassword, verifyEpicPassword } from './epic-password-hash.utils'


describe('hashEpicPassword / verifyEpicPassword', () => {

    // A test value made for this run: no real password in the tests.
    const password = `pw-${Math.random().toString(36).slice(2)}`

    let hash: string

    beforeAll(async () => {
        hash = await hashEpicPassword(password)
    })

    it('makes a hash of the documented format, within the column length', () => {
        expect(hash).toMatch(/^scrypt\$16384\$8\$5\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/)
        expect(hash.length).toBeLessThanOrEqual(EpicPasswordHash.MAX_LENGTH)
        const [, , , , salt, key] = hash.split('$')
        expect(Buffer.from(salt, 'base64')).toHaveLength(16)
        expect(Buffer.from(key, 'base64')).toHaveLength(64)
    })

    it('verifies the password of the hash', async () => {
        expect(await verifyEpicPassword(password, hash)).toBe(true)
    })

    it('does not verify a wrong password', async () => {
        expect(await verifyEpicPassword(`${password}x`, hash)).toBe(false)
        expect(await verifyEpicPassword(password.toUpperCase(), hash)).toBe(false)
        expect(await verifyEpicPassword('', hash)).toBe(false)
    })

    it('makes two different hashes of one password, and both verify', async () => {
        const other = await hashEpicPassword(password)

        expect(other).not.toBe(hash)
        expect(await verifyEpicPassword(password, other)).toBe(true)
    })

    it('verifies a hash made with other parameters, read from the string', async () => {
        const [, , , , salt] = hash.split('$')
        const { scryptSync } = await import('node:crypto')
        const key = scryptSync(password, Buffer.from(salt, 'base64'), 32, { N: 1024, r: 4, p: 1 })

        expect(await verifyEpicPassword(password, `scrypt$1024$4$1$${salt}$${key.toString('base64')}`)).toBe(true)
    })

    /** The hash with part `index` (0 = scheme … 5 = key) replaced. */
    function withPart(index: number, value: string): string {
        const parts = hash.split('$')
        parts[index] = value
        return parts.join('$')
    }

    it.each([
        ['an empty string', () => ''],
        ['another scheme', () => withPart(0, 'bcrypt')],
        ['a missing part', () => hash.split('$').slice(0, 5).join('$')],
        ['an extra part', () => `${hash}$x`],
        ['a cost that is no number', () => withPart(1, 'many')],
        ['a cost that is no power of two', () => withPart(1, '16000')],
        ['a cost above 2^17', () => withPart(1, String(2 ** 18))],
        ['a block size above 8', () => withPart(2, '9')],
        ['a parallelization above 8', () => withPart(3, '9')],
        ['a block size of zero', () => withPart(2, '0')],
        ['a salt that is no base64', () => withPart(4, '!!!!')],
        ['a key that is too short', () => withPart(5, 'AAAA')],
        ['a string that is too long', () => `${hash}${'A'.repeat(300)}`],
        ['no string at all', () => 42 as unknown as string],
    ])('gives false, and does not throw, for %s', async (_, broken) => {
        expect(await verifyEpicPassword(password, broken())).toBe(false)
    })

    it.each([
        ['N = 2^20', () => withPart(1, String(2 ** 20))],
        ['r = 32', () => withPart(2, '32')],
        ['p = 16', () => withPart(3, '16')],
    ])('refuses a hash above the bounds (%s) without running scrypt', async (_, costly) => {
        const start = performance.now()

        expect(await verifyEpicPassword(password, costly())).toBe(false)
        expect(performance.now() - start).toBeLessThan(50)
    })

    it('verifies a hash at the memory bound (N = 2^17, r = 8): maxmem fits', async () => {
        const { scryptSync } = await import('node:crypto')
        const salt = Buffer.from('0123456789abcdef')
        const key = scryptSync(password, salt, 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
        const hash = ['scrypt', 2 ** 17, 8, 1, salt.toString('base64'), key.toString('base64')].join('$')

        expect(await verifyEpicPassword(password, hash)).toBe(true)
    }, 30_000)

})
