import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

import { compilerOptions } from '../../tsconfig.base.json'


/**
 * e2e suite of svt-db-agent-next: boots the real NestJS application against a real PostgreSQL database
 * (`.env.test`, whose database name must end with `_e2e_test`) and drives it through the request dispatcher.
 * Separate from the workspace's unit config because NestJS needs decorator metadata for constructor
 * injection, which Vitest's esbuild transform never emits; swc does.
 */
const workspaceRoot = resolve(__dirname, '../..')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const alias = Object.entries(compilerOptions.paths).map(([key, [target]]) => {
    if (key.endsWith('/*')) {
        return {
            find: new RegExp(`^${escapeRegExp(key.slice(0, -2))}/(.*)$`),
            replacement: `${resolve(workspaceRoot, target.replace(/\/\*$/, ''))}/$1`,
        }
    }
    return {
        find: new RegExp(`^${escapeRegExp(key)}$`),
        replacement: resolve(workspaceRoot, target),
    }
})

export default defineConfig({
    plugins: [
        swc.vite({
            tsconfigFile: false,
            module: { type: 'es6' },
            jsc: {
                target: 'es2022',
                keepClassNames: true,
                parser: { syntax: 'typescript', decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
            },
        }),
    ],
    resolve: {
        alias,
    },
    // Vite would otherwise create node_modules/.vite under the app folder (the test root).
    cacheDir: resolve(workspaceRoot, 'node_modules/.vite/svt-db-agent-next-e2e'),
    test: {
        root: __dirname,
        environment: 'node',
        globals: true,
        include: ['test-e2e/**/*.e2e-spec.ts'],
        setupFiles: ['./test-e2e/utils/e2e-env.ts'],
        // One database: spec files must not truncate it concurrently.
        fileParallelism: false,
        testTimeout: 30000,
        hookTimeout: 60000,
        reporters: ['default'],
    },
})
