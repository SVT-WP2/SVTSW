import baseConfig from '../../eslint.config.mjs';

// `src/db` keeps the import rules it had as the libs `svt-db/orm` and `svt-db/data`: the database layer is
// Node-only and knows nothing about the SPA, the BFF, the Kafka contract or the app layers above it.
const DB_NODE_ONLY = {
    group: ['@angular/*', '@ngrx/*', 'rxjs', 'rxjs/*', '@env', '@env/*'],
    message: 'src/db is Node-only — no Angular / rxjs / environment imports here.',
};
const DB_NO_APP_LAYERS = {
    group: ['**/modules/**'],
    message: 'src/db is the database layer — it must not import the handlers or the Kafka layer of the app.',
};

export default [
    ...baseConfig,
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
                            group: ['epic/*', 'epic-ui/*', 'epic-api-types/kafka'],
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
                            group: ['epic/*', 'epic-ui/*', 'epic-api-types', 'epic-api-types/*'],
                            message: 'src/db/orm is the database layer — it must not depend on the UI, the BFF or the contract types.',
                        },
                        DB_NO_APP_LAYERS,
                    ],
                },
            ],
        },
    },
];
