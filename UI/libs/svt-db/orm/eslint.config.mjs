import baseConfig from '../../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            // Node-only MikroORM layer of svt-db-agent-next. It knows nothing about the SPA, the BFF
            // or the Kafka contract: no Angular, no rxjs, no epic-ui/*, no epic/*.
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@angular/*', '@ngrx/*', 'rxjs', 'rxjs/*', '@env', '@env/*'],
                            message: 'svt-db/orm is Node-only — no Angular / rxjs / environment imports here.',
                        },
                        {
                            group: ['epic/*', 'epic-ui/*', 'epic-api-types'],
                            message: 'svt-db/orm is the database layer — it must not depend on the UI, the BFF or the contract types.',
                        },
                    ],
                },
            ],
        },
    },
];
