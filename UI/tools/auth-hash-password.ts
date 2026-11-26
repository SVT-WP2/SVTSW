/**
 * Prints the hash of a password for the table `SvtUser`, made as the BFF makes it (`hashEpicPassword`). For the
 * first Admin of an installation (Environment/README.md, "The first Admin").
 *
 *   npm run auth:hash-password
 *
 * The password is asked twice and not shown. It is never an argument: an argument stays in the shell history. From
 * a pipe (no terminal) the first line of the input is the password, asked once. Only the hash goes to stdout.
 */
import { stderr, stdin, stdout } from 'node:process'

import { hashEpicPassword } from '../libs/epic/core/src/auth'


/** As for every password the BFF sets (ticket 396). */
const MIN_LENGTH = 8
const MAX_LENGTH = 128

class CancelledError extends Error {}

async function main(): Promise<void> {
    let password: string
    if (stdin.isTTY) {
        password = await askHidden('Password: ')
        checkLength(password)
        const repeated = await askHidden('Repeat the password: ')
        if (repeated !== password) {
            throw new Error('The two passwords differ.')
        }
    }
    else {
        password = await readFirstLine()
        checkLength(password)
    }

    const hash = await hashEpicPassword(password)
    stderr.write('The hash, for the column "passwordHash":\n')
    stdout.write(`${hash}\n`)
}

function checkLength(password: string): void {
    const length = [...password].length
    if (length < MIN_LENGTH || length > MAX_LENGTH) {
        throw new Error(`A password has ${MIN_LENGTH} to ${MAX_LENGTH} characters; this one has ${length}.`)
    }
}

/** Reads one line from the terminal without showing it. */
function askHidden(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        stderr.write(prompt)
        let value = ''
        function finish(): void {
            stdin.off('data', onData)
            stdin.setRawMode(false)
            stdin.pause()
            stderr.write('\n')
        }
        function onData(chunk: string): void {
            for (const char of chunk) {
                if (char === '\r' || char === '\n') {
                    finish()
                    resolve(value)
                    return
                }
                if (char === '\u0003' || char === '\u0004') {
                    finish()
                    reject(new CancelledError('Cancelled.'))
                    return
                }
                if (char === '\u007f' || char === '\b') {
                    value = [...value].slice(0, -1).join('')
                }
                else if (char >= ' ') {
                    value += char
                }
            }
        }
        stdin.setEncoding('utf8')
        stdin.setRawMode(true)
        stdin.resume()
        stdin.on('data', onData)
    })
}

/** The first line of a pipe, without its line end. */
async function readFirstLine(): Promise<string> {
    let text = ''
    stdin.setEncoding('utf8')
    for await (const chunk of stdin) {
        text += String(chunk)
        if (text.includes('\n')) {
            break
        }
    }
    return text.split(/\r?\n/)[0]
}

main().then(
    () => process.exit(0),
    (error: unknown) => {
        stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exit(1)
    },
)
