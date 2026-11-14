import baseConfig, { EPIC_API_TYPES_RESTRICTED_IMPORTS } from '../../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            // The same restriction the root config applies to libs/epic-api-types (that one is what `npm run lint`
            // and CI use); repeated here because `nx lint epic-api-types/kafka` resolves `files` against this folder.
            // Anything that needs RxJS, NestJS or a decorator belongs in `epic/entities`.
            'no-restricted-imports': EPIC_API_TYPES_RESTRICTED_IMPORTS,
        },
    },
];
