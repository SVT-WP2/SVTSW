import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

import { appRoot, swcDecoratorsPlugin, tsconfigAliases } from './vitest.shared'


/**
 * e2e suite of svt-db-agent-next: boots the real NestJS application against a real PostgreSQL database
 * (`.env.test`, whose database name must end with `_e2e_test`) and drives it through the request dispatcher.
 * Separate from the unit config (`vitest.config.ts`): one database, so the spec files run one after the other.
 * Both use the swc transform of `vitest.shared.ts` for the decorator metadata NestJS needs.
 */
export default defineConfig({
    plugins: [swcDecoratorsPlugin()],
    resolve: {
        alias: tsconfigAliases,
    },
    cacheDir: resolve(appRoot, 'node_modules/.vite/e2e'),
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
