import angular from '@analogjs/vite-plugin-angular'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

import { compilerOptions } from './tsconfig.base.json'


// Tests always run in UTC so date-sensitive assertions are stable.
process.env.TZ = 'UTC'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Mirrors the `paths` in tsconfig.base.json so specs can import through the workspace
 * aliases (`epic-ui/api`, `@env/environment`, ...) exactly as application code does.
 * Non-wildcard aliases are anchored so `epic-ui/api` does not swallow `epic-ui/api/__mock__`.
 */
const alias = Object.entries(compilerOptions.paths).map(([key, [target]]) => {
    if (key.endsWith('/*')) {
        return {
            find: new RegExp(`^${escapeRegExp(key.slice(0, -2))}/(.*)$`),
            replacement: `${resolve(__dirname, target.replace(/\/\*$/, ''))}/$1`,
        }
    }

    return {
        find: new RegExp(`^${escapeRegExp(key)}$`),
        replacement: resolve(__dirname, target),
    }
})

export default defineConfig({
    // The spec tsconfig must cover every spec file: the plugin only applies the Angular
    // transforms (signal inputs, template compilation) to files inside the TS program.
    plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
    resolve: {
        alias,
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./test-setup.ts'],
        // Relative to the scan root, so `vitest run --dir libs/<lib>` (the per-project
        // `nx test` targets) narrows correctly instead of matching nothing.
        include: ['**/*.{spec,test}.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.angular/**', '**/.nx/**'],
        passWithNoTests: true,
        reporters: ['default'],
    },
})
