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

export default {
    displayName: 'epic-ui/common/auth',
    preset: '../../../../jest.preset.js',
    setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
    coverageDirectory: '../../../../coverage/libs/epic-ui/common/auth',
    transform: {
        '^.+\\.(ts|mjs|js|html)$': [
            'jest-preset-angular',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
                stringifyContentPathRegex: '\\.(html|svg)$',
            },
        ],
    },
    transformIgnorePatterns: [
        `node_modules/(?!(${packagesToTransform}))`,
        'node_modules/(?!.*\\.mjs$)',
    ],
    snapshotSerializers: [
        'jest-preset-angular/build/serializers/no-ng-attributes',
        'jest-preset-angular/build/serializers/ng-snapshot',
        'jest-preset-angular/build/serializers/html-comment',
    ],
}
