import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

import { appRoot, swcDecoratorsPlugin, tsconfigAliases } from './vitest.shared'


/**
 * Parity suite of svt-db-agent-next (`docs/03-parity-testing.md`): a Kafka client that plays
 * the same requests against whichever DB agent is consuming `svt.db-agent.request` on the broker of `.env.test`
 * and records the replies (`test-parity/record.parity-spec.ts`), and a comparison of two such recordings
 * (`test-parity/compare.parity-spec.ts`). Nothing here boots the application or touches a database.
 */
export default defineConfig({
    plugins: [swcDecoratorsPlugin()],
    resolve: {
        alias: tsconfigAliases,
    },
    cacheDir: resolve(appRoot, 'node_modules/.vite/parity'),
    test: {
        root: __dirname,
        environment: 'node',
        globals: true,
        include: ['test-parity/**/*.parity-spec.ts'],
        setupFiles: ['./test-parity/utils/parity-env.ts'],
        // The cases write to one database in a fixed order.
        fileParallelism: false,
        sequence: { concurrent: false },
        testTimeout: 180000,
        hookTimeout: 180000,
        reporters: ['default'],
    },
})
