import baseConfig from '../../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            // Node-only data layer of svt-db-agent-next (MikroORM entities, repositories, domain
            // logic). It knows nothing about the SPA or the BFF: no Angular, no rxjs, no epic-ui/*,
            // no epic/*. The Kafka wire types stay in the app's handlers (phase 4).
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@angular/*', '@ngrx/*', 'rxjs', 'rxjs/*', '@env', '@env/*'],
                            message: 'svt-db/data is Node-only — no Angular / rxjs / environment imports here.',
                        },
                        {
                            group: ['epic/*', 'epic-ui/*'],
                            message: 'svt-db/data is the database layer — it must not depend on the UI or the BFF.',
                        },
                    ],
                },
            ],
        },
    },
];
