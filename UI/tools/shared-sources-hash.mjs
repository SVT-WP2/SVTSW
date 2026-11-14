// Prints one hash over the files of ../Shared (relative path + content), for the `sharedGlobals` input of nx.json.
// Nx hashes only files inside its workspace (UI/), so without this input a change in Shared/ reuses a cached build.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'


const sharedRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../Shared')
const hash = createHash('sha256')

function visit(dir) {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') {
                visit(path)
            }
        }
        else if (entry.isFile()) {
            hash.update(relative(sharedRoot, path).split(sep).join('/'))
            hash.update('\0')
            // A CRLF and an LF checkout of the same commit give the same hash.
            hash.update(readFileSync(path, 'utf8').split('\r\n').join('\n'))
            hash.update('\0')
        }
    }
}

if (existsSync(sharedRoot)) {
    visit(sharedRoot)
}
console.log(hash.digest('hex'))
