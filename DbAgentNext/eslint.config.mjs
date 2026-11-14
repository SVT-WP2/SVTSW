// @ts-check

import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'


const __dirname = dirname(fileURLToPath(import.meta.url))

const RXJS_RX_RESTRICTED_PATH = {
    name: 'rxjs/Rx',
    message: 'Please import directly from \'rxjs\' instead',
}

// `src/db` keeps the import rules it had as the libs `svt-db/orm` and `svt-db/data`: the database layer is
// Node-only and knows nothing about the Kafka contract or the app layers above it.
const DB_NODE_ONLY = {
    group: ['@angular/*', '@ngrx/*', 'rxjs', 'rxjs/*', '@env', '@env/*'],
    message: 'src/db is Node-only — no Angular / rxjs / environment imports here.',
}
const DB_NO_APP_LAYERS = {
    group: ['**/modules/**'],
    message: 'src/db is the database layer — it must not import the handlers or the Kafka layer of the app.',
}

/**
 * The TypeScript rules of the UI workspace (`../UI/eslint.config.mjs`) without the Angular ones, so that the code
 * reads the same on both sides of `Shared/`, plus the import rules of `src/db`.
 */
export default tseslint.config(
    {
        ignores: ['**/node_modules/', 'dist/', 'test-parity/snapshots/'],
    },
    {
        files: ['**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            'import': importPlugin,
            'unused-imports': unusedImportsPlugin,
            '@stylistic': stylistic,
        },
        rules: {
            // ESLint Core
            'no-underscore-dangle': 'off',
            'no-inner-declarations': 'off',
            'max-lines': 'off',
            'curly': ['error', 'all'],
            'id-denylist': ['error', 'e'],
            'no-restricted-imports': ['error', { paths: [RXJS_RX_RESTRICTED_PATH] }],
            'max-classes-per-file': 'off',
            'no-empty': 'off',
            'sort-keys': 'off',
            'arrow-body-style': 'off',
            'object-shorthand': 'off',
            'no-unused-vars': 'off',
            // ESLint Stylistic
            '@stylistic/brace-style': ['error', 'stroustrup'],
            '@stylistic/semi': ['error', 'never'],
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,
                FunctionDeclaration: { parameters: 'first' },
            }],
            '@stylistic/arrow-parens': 'off',
            '@stylistic/max-len': ['error', { code: 140 }],
            '@stylistic/no-multiple-empty-lines': ['error', { max: 2 }],
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/space-before-function-paren': 'off',
            '@stylistic/padded-blocks': ['error', { classes: 'always' }],
            '@stylistic/member-delimiter-style': ['error', {
                multiline: { delimiter: 'none' },
                overrides: { interface: { multiline: { delimiter: 'none' } } },
            }],
            // ESLint TypeScript
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
            'no-empty-function': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'dot-notation': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
            '@typescript-eslint/dot-notation': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/array-type': 'off',
            '@typescript-eslint/prefer-includes': 'off',
            '@typescript-eslint/consistent-indexed-object-style': 'off',
            '@typescript-eslint/class-literal-property-style': 'off',
            '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
            '@typescript-eslint/member-ordering': [
                'error',
                {
                    default: [
                        // Index signature
                        'signature',

                        // Fields
                        'public-static-field',
                        'protected-static-field',
                        'private-static-field',
                        'public-decorated-field',
                        'protected-decorated-field',
                        'private-decorated-field',
                        'public-instance-field',
                        'protected-instance-field',
                        'private-instance-field',
                        'public-abstract-field',
                        'protected-abstract-field',

                        // Constructors
                        'public-constructor',
                        'protected-constructor',
                        'private-constructor',

                        // Methods
                        'public-static-method',
                        'protected-static-method',
                        'private-static-method',
                        'public-decorated-method',
                        'protected-decorated-method',
                        'private-decorated-method',
                        'public-instance-method',
                        'protected-instance-method',
                        'private-instance-method',
                        'public-abstract-method',
                        'protected-abstract-method',
                    ],
                },
            ],
            '@typescript-eslint/no-inferrable-types': ['error', { ignoreParameters: true }],
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-base-to-string': 'warn',
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            // Import plugin
            'import/no-duplicates': 'error',
            'import/newline-after-import': ['error', { count: 2 }],
            'import/order': [
                'error',
                {
                    alphabetize: { order: 'asc', caseInsensitive: true },
                    'newlines-between': 'always',
                },
            ],
            // Unused imports plugin
            'unused-imports/no-unused-imports': 'error',
        },
    },
    {
        // MikroORM entities, repositories, domain logic.
        files: ['src/db/data/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        DB_NODE_ONLY,
                        {
                            group: ['epic/*', 'epic-ui/*', 'svt-ts-types/kafka'],
                            message: 'src/db/data is the database layer — it must not depend on the UI, the BFF or the Kafka contract.',
                        },
                        DB_NO_APP_LAYERS,
                    ],
                },
            ],
        },
    },
    {
        // MikroORM module, options, naming strategy.
        files: ['src/db/orm/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        DB_NODE_ONLY,
                        {
                            group: ['epic/*', 'epic-ui/*', 'svt-ts-types', 'svt-ts-types/*'],
                            message: 'src/db/orm is the database layer — it must not depend on the UI, the BFF or the contract types.',
                        },
                        DB_NO_APP_LAYERS,
                    ],
                },
            ],
        },
    },
)
