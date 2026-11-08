import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

import { compilerOptions } from '../../tsconfig.base.json'


const workspaceRoot = resolve(__dirname, '../..')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The `paths` of tsconfig.base.json (`epic/entities`, `svt-ts-types`, `svt-ts-types/kafka`, …), as in the root config. */
const alias = Object.entries(compilerOptions.paths).map(([key, [target]]) => (
    key.endsWith('/*')
        ? {
            find: new RegExp(`^${escapeRegExp(key.slice(0, -2))}/(.*)$`),
            replacement: `${resolve(workspaceRoot, target.replace(/\/\*$/, ''))}/$1`,
        }
        : { find: new RegExp(`^${escapeRegExp(key)}$`), replacement: resolve(workspaceRoot, target) }
))

/**
 * e2e suite of epic-measure-api (`test-e2e/`, `npx nx e2e epic-measure-api`): the BFF booted in-process, talking over a
 * dedicated Kafka broker to DbAgentNext, which the global setup runs as a child process against a real PostgreSQL
 * database. Separate from the workspace's unit config (`vitest.config.ts`, jsdom + Angular): Node environment, and
 * the swc transform for the decorator metadata NestJS's constructor injection needs (esbuild never emits it). One
 * database and one agent, so the spec files run one after the other.
 */
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
    cacheDir: resolve(workspaceRoot, 'node_modules/.vite/epic-measure-api-e2e'),
    test: {
        root: __dirname,
        environment: 'node',
        globals: true,
        include: ['test-e2e/**/*.e2e-spec.ts'],
        globalSetup: ['./test-e2e/utils/global-setup.ts'],
        setupFiles: ['./test-e2e/utils/e2e-env.ts'],
        // One database and one agent: spec files must not truncate the database under each other.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 120_000,
        // The global teardown stops the agent gracefully (its Kafka consumer finishes its fetch, then leaves the group).
        teardownTimeout: 30_000,
        reporters: ['default'],
    },
})
