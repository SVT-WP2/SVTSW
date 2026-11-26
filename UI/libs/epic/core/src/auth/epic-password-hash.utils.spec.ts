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
        ['a cost above the limit', () => withPart(1, String(2 ** 21))],
        ['a block size of zero', () => withPart(2, '0')],
        ['a salt that is no base64', () => withPart(4, '!!!!')],
        ['a key that is too short', () => withPart(5, 'AAAA')],
        ['a string that is too long', () => `${hash}${'A'.repeat(300)}`],
        ['no string at all', () => 42 as unknown as string],
    ])('gives false, and does not throw, for %s', async (_, broken) => {
        expect(await verifyEpicPassword(password, broken())).toBe(false)
    })

})
