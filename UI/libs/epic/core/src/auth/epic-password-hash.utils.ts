import { randomBytes, scrypt, ScryptOptions, timingSafeEqual } from 'node:crypto'


/**
 * The password hash of SVTSW (decision D7 of ticket 392): Node's `scrypt`, a random salt for each password, and one
 * string that holds the parameters, the salt and the key:
 *
 * ```
 * scrypt$<N>$<r>$<p>$<salt, base64>$<key, base64>
 * ```
 *
 * The parameters are in the string, so they can be raised later and the old hashes still verify. Only the BFF makes
 * and checks a hash; the DB agent stores it as an opaque string. A plain password is never logged, stored or sent.
 */
export namespace EpicPasswordHash {

    export const SCHEME = 'scrypt'

    /** The parameters of a new hash. */
    export const COST = 16384
    export const BLOCK_SIZE = 8
    export const PARALLELIZATION = 5
    export const KEY_LENGTH = 64
    export const SALT_LENGTH = 16

    /** The column `SvtUser.passwordHash` is a `varchar(255)`. */
    export const MAX_LENGTH = 255

}

/**
 * The parameters that a stored hash may have. Above them `verifyEpicPassword` answers `false` without running
 * `scrypt`: a broken or hostile hash string cannot make one attempt cost more than about 128 MiB (`128 * N * r`)
 * and the time of 8 rounds at that size. Today's hashes (N = 2^14, r = 8, p = 5) are well inside.
 */
const LIMITS = {
    minCost: 2 ** 10,
    maxCost: 2 ** 17,
    maxBlockSize: 8,
    maxParallelization: 8,
    minSaltLength: 8,
    minKeyLength: 16,
    maxKeyLength: 128,
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

const DECIMAL = /^[1-9][0-9]{0,8}$/

type ParsedHash = {
    options: ScryptOptions
    salt: Buffer
    key: Buffer
}

/** The hash of `password`, with a new random salt: two hashes of one password differ. */
export async function hashEpicPassword(password: string): Promise<string> {
    const salt = randomBytes(EpicPasswordHash.SALT_LENGTH)
    const options: ScryptOptions = {
        N: EpicPasswordHash.COST,
        r: EpicPasswordHash.BLOCK_SIZE,
        p: EpicPasswordHash.PARALLELIZATION,
    }
    const key = await deriveKey(password, salt, EpicPasswordHash.KEY_LENGTH, options)
    return [
        EpicPasswordHash.SCHEME,
        options.N,
        options.r,
        options.p,
        salt.toString('base64'),
        key.toString('base64'),
    ].join('$')
}

/**
 * True when `password` is the password of `hash`. False for a wrong password and for a string that is no hash of
 * this format; it never throws. The keys are compared in constant time.
 */
export async function verifyEpicPassword(password: string, hash: string): Promise<boolean> {
    const parsed = parseHash(hash)
    if (!parsed || typeof password !== 'string') {
        return false
    }
    try {
        const key = await deriveKey(password, parsed.salt, parsed.key.length, parsed.options)
        return timingSafeEqual(key, parsed.key)
    }
    catch {
        return false
    }
}

function parseHash(hash: unknown): ParsedHash | null {
    if (typeof hash !== 'string' || hash.length > EpicPasswordHash.MAX_LENGTH) {
        return null
    }
    const parts = hash.split('$')
    if (parts.length !== 6 || parts[0] !== EpicPasswordHash.SCHEME) {
        return null
    }
    const [, costText, blockSizeText, parallelizationText, saltText, keyText] = parts
    if (![costText, blockSizeText, parallelizationText].every((text) => DECIMAL.test(text))
        || !BASE64.test(saltText) || !BASE64.test(keyText)) {
        return null
    }
    const cost = Number(costText)
    const blockSize = Number(blockSizeText)
    const parallelization = Number(parallelizationText)
    const salt = Buffer.from(saltText, 'base64')
    const key = Buffer.from(keyText, 'base64')
    const isPowerOfTwo = (cost & (cost - 1)) === 0
    if (!isPowerOfTwo || cost < LIMITS.minCost || cost > LIMITS.maxCost
        || blockSize > LIMITS.maxBlockSize || parallelization > LIMITS.maxParallelization
        || salt.length < LIMITS.minSaltLength || key.length < LIMITS.minKeyLength || key.length > LIMITS.maxKeyLength) {
        return null
    }
    return { options: { N: cost, r: blockSize, p: parallelization }, salt, key }
}

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
    // scrypt needs 128 * r * (N + p + 2) bytes (OpenSSL); `maxmem` allows that and 1 MiB more, and nothing beyond.
    const maxmem = 128 * (options.r ?? 0) * ((options.N ?? 0) + (options.p ?? 0) + 2) + 1024 * 1024
    return new Promise((resolve, reject) => {
        scrypt(password.normalize('NFC'), salt, keyLength, { ...options, maxmem }, (error, key) => {
            if (error) {
                reject(error)
            }
            else {
                resolve(key)
            }
        })
    })
}
