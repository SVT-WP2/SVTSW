import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            // This lib is compiled into BOTH the Angular SPA and the NestJS apps. It must stay free of
            // runtime framework dependencies and of the Node-only / browser-only libs — types, enums and
            // tiny pure helpers only. Anything that needs a decorator belongs in `epic/entities` (BE)
            // or `epic-ui/api` (FE).
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@angular/*', '@ngrx/*', 'rxjs', 'rxjs/*'],
                            message: 'epic-api-types is shared with the NestJS apps — no Angular / rxjs imports here.',
                        },
                        {
                            group: ['@nestjs/*', 'class-validator', 'class-transformer', 'kafkajs'],
                            message: 'epic-api-types is shared with the Angular SPA — no NestJS / class-validator imports here.',
                        },
                        {
                            group: ['epic/*', 'epic-ui/*', '@env', '@env/*'],
                            message: 'epic-api-types is the lowest layer — it must not depend on epic/* or epic-ui/*.',
                        },
                    ],
                },
            ],
        },
    },
];
