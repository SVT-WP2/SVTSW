// @ts-check

import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import angular from 'angular-eslint'
import importPlugin from 'eslint-plugin-import'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'
import {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import tseslint from 'typescript-eslint'

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_COMPONENT_SELECTORS = [
    'ag',
    'app',
    'epic',
]
export const DEFAULT_DIRECTIVE_SELECTORS = [
    'ag',
    'app',
    'epic',
    'ag',
]

export const ROOT_CONFIG = tseslint.config(
    {
        ignores: ['**/node_modules/', '**/assets/', 'dist/', '.angular/', '.nx/'],
    },
    {
        files: ['**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
            ...angular.configs.tsRecommended,
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
            '@stylistic': stylistic
        },
        processor: angular.processInlineTemplates,
        rules: {
            // ESLint Core
            'no-underscore-dangle': 'off',
            'no-inner-declarations': 'off',
            'max-lines': 'off',
            'curly': ['error', 'all'],
            'id-denylist': ['error', 'e'],
            'no-restricted-imports': [
                'error',
                {
                    'paths': [
                        {
                            'name': 'rxjs/Rx',
                            'message': 'Please import directly from \'rxjs\' instead'
                        }
                    ]
                }
            ],
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
                'SwitchCase': 1,
                'FunctionDeclaration': { 'parameters': 'first' },
            }],
            '@stylistic/arrow-parens': 'off',
            '@stylistic/max-len': ['error', { 'code': 140 }],
            '@stylistic/no-multiple-empty-lines': ['error', { 'max': 2 }],
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/space-before-function-paren': 'off',
            '@stylistic/padded-blocks': ['error', { 'classes': 'always' }],
            '@stylistic/member-delimiter-style': ['error', {
                'multiline': {
                    'delimiter': 'none'
                },
                'overrides': {
                    'interface': {
                        'multiline': {
                            'delimiter': 'none'
                        }
                    }
                }
            }],
            // ESLint TypeScript
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': ['error', { 'functions': false }],
            'no-empty-function': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'dot-notation': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
            '@typescript-eslint/dot-notation': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/unbound-method': ['error', { 'ignoreStatic': true }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/array-type': 'off',
            '@typescript-eslint/prefer-includes': 'off',
            '@typescript-eslint/consistent-indexed-object-style': 'off',
            '@typescript-eslint/class-literal-property-style': 'off',
            '@typescript-eslint/explicit-member-accessibility': ['error', { 'accessibility': 'no-public' }],
            '@typescript-eslint/member-ordering': [
                'error',
                {
                    'default': [
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
                    ]
                }
            ],
            '@typescript-eslint/no-inferrable-types': ['error', { 'ignoreParameters': true }],
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-base-to-string': 'warn',
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            // ESLint Angular
            '@angular-eslint/use-component-view-encapsulation': 'error',
            '@angular-eslint/no-conflicting-lifecycle': 'error',
            '@angular-eslint/prefer-standalone': 'off',
            ...getAngularSelectorsRules({
                component: DEFAULT_COMPONENT_SELECTORS,
                directive: DEFAULT_DIRECTIVE_SELECTORS,
            }),
            // Import plugin
            'import/no-duplicates': 'error',
            'import/newline-after-import': ['error', { 'count': 2 }],
            'import/order': [
                'error',
                {
                    'alphabetize': {
                        'order': 'asc',
                        'caseInsensitive': true
                    },
                    'newlines-between': 'always'
                }
            ],
            // Unused imports plugin
            'unused-imports/no-unused-imports': 'error',
        }
    },
    {
        // Everything in this config object targets our HTML files (external templates,
        // and inline templates as long as we have the `processor` set on our TypeScript config above)
        files: ['**/*.html'],
        ignores: ['**/assets/**'],
        extends: [
            // Apply the recommended Angular template rules
            ...angular.configs.templateRecommended,
            // Apply the Angular template rules which focus on accessibility of our apps
            ...angular.configs.templateAccessibility,
        ],
        rules: {
            '@angular-eslint/template/no-autofocus': 'off',
            '@angular-eslint/template/click-events-have-key-events': 'off',
            '@angular-eslint/template/interactive-supports-focus': 'off',
            '@angular-eslint/template/alt-text': 'off',
        }
    },
)

/**
 * @typedef {Object} AngularSelectorsParams
 * @property {string[]} [component] - An array of component selectors
 * @property {string[]} [directive] - An array of directive selectors
 */

/**
 * @param {AngularSelectorsParams} [params]
 * @returns {Object}
 */
export function getAngularSelectorsRules(params) {
    return {
        '@angular-eslint/directive-selector': [
            'error',
            {
                'type': 'attribute',
                'prefix': (params?.directive ?? []),
                'style': 'camelCase'
            }
        ],
        '@angular-eslint/component-selector': [
            'error',
            {
                'type': 'element',
                'prefix': (params?.component ?? []),
                'style': 'kebab-case'
            }
        ]
    }
}

/**
 * @param {AngularSelectorsParams} [params]
 * @returns {Object}
 */
export function extendRootConfigWithNgSelectors(params) {
    return [
        ...ROOT_CONFIG,
        {
            files: ['**/*.ts'],
            rules: getAngularSelectorsRules({
                component: [...DEFAULT_COMPONENT_SELECTORS, ...(params?.component ?? [])],
                directive: [...DEFAULT_DIRECTIVE_SELECTORS, ...(params?.directive ?? [])],
            }),
        },
    ]
}

export default ROOT_CONFIG
