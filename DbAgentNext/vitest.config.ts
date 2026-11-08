import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

import { appRoot, swcDecoratorsPlugin, tsconfigAliases } from './vitest.shared'


/**
 * Unit tests of svt-db-agent-next (`src/**\/*.spec.ts`): Node environment, the aliases of `tsconfig.json` and the
 * swc transform of `vitest.shared.ts`. The e2e and parity suites have their own configs.
 */
export default defineConfig({
    plugins: [swcDecoratorsPlugin()],
    resolve: {
        alias: tsconfigAliases,
    },
    cacheDir: resolve(appRoot, 'node_modules/.vite/unit'),
    test: {
        root: appRoot,
        environment: 'node',
        globals: true,
        include: ['src/**/*.spec.ts'],
        // Tests always run in UTC so date-sensitive assertions are stable (as in the UI workspace config).
        env: { TZ: 'UTC' },
        reporters: ['default'],
    },
})
