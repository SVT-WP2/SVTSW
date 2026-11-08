import { resolve } from 'node:path'

import swc from 'unplugin-swc'

import { compilerOptions } from './tsconfig.json'


/**
 * Shared by the Vitest configs of svt-db-agent-next (unit, e2e, parity): the path aliases of `tsconfig.json`
 * (`svt-ts-types`, `svt-ts-types/kafka`, which point into `../Shared`) and the swc transform. NestJS needs
 * decorator metadata for constructor injection, which Vitest's esbuild transform never emits; swc does.
 */
export const appRoot = __dirname

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const tsconfigAliases = Object.entries(compilerOptions.paths).map(([key, [target]]) => ({
    find: new RegExp(`^${escapeRegExp(key)}$`),
    replacement: resolve(appRoot, compilerOptions.baseUrl, target),
}))

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
