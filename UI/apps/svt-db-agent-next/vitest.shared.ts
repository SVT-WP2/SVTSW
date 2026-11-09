import { resolve } from 'node:path'

import swc from 'unplugin-swc'

import { compilerOptions } from '../../tsconfig.base.json'


/**
 * Shared by the e2e and the parity Vitest configs of svt-db-agent-next: the workspace path aliases of
 * `tsconfig.base.json` and the swc transform. NestJS needs decorator metadata for constructor injection, which
 * Vitest's esbuild transform never emits; swc does.
 */
export const workspaceRoot = resolve(__dirname, '../..')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const workspaceAliases = Object.entries(compilerOptions.paths).map(([key, [target]]) => {
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

export function swcDecoratorsPlugin(): ReturnType<typeof swc.vite> {
    return swc.vite({
        tsconfigFile: false,
        module: { type: 'es6' },
        jsc: {
            target: 'es2022',
            keepClassNames: true,
            parser: { syntax: 'typescript', decorators: true },
            transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
        },
    })
}
