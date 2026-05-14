import presets from 'jest-preset-angular/presets'
import { JestConfigWithTsJest, pathsToModuleNameMapper } from 'ts-jest'

import { compilerOptions } from './tsconfig.base.json'


const presetConfig = presets.createCjsPreset()

const packagesToTransform = [
    '@angular',
    '@ngx-translate',
    'ngx-translate-multi-http-loader',
    'ngx-toastr',
    '@ng-select',
    'ngx-echarts',
    'echarts',
    'zrender',
    'lodash-es',
    'crypto-es',
    '.*\\.mjs',
].join('|')

const packagesToTransformWithBabel = [
    'echarts',
    'zrender',
    'lodash-es',
    'crypto-es',
].join('|')

const config: JestConfigWithTsJest = {
    ...presetConfig,
    globalSetup: './jest-global-setup.js',
    modulePaths: [compilerOptions.baseUrl],
    moduleNameMapper: {
        ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>' }),
        '^lodash-es$': 'lodash',
        '^crypto-es$': 'crypto-js',
    },
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
    transformIgnorePatterns: [
        `node_modules/(?!(${packagesToTransform}))`,
        'node_modules/(?!.*\\.mjs$)',
    ],
    transform: {
        [`^.+node_modules[/\\\\](${packagesToTransformWithBabel})[/\\\\].+\\.(js|mjs)$`]: 'babel-jest',
        ...presetConfig.transform,
    },
}

export default config
